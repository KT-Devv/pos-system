-- KT POS System, migration 007: close a direct-write hole on sales, sale_lines and stock_movements,
-- and stop a cashier from pinning a sale on a coworker.
--
-- Run it once in the Supabase SQL editor on any existing database (002-006 first, in order). It is
-- safe to run again. Fresh installs get all of this from schema.v2.sql.
--
-- What was wrong: the "admins manage sales" / "sale lines" / "stock movements" policies, plus the
-- insert/update/delete grants added in 005, let an admin's own access token write these tables
-- directly through the API -- not just through create_sale()/record_stock_movement(). An admin (or
-- anyone holding a stolen admin session) could insert a fake sale with an arbitrary total, edit a
-- recorded sale's amount after the fact, or delete sales and stock movements outright, all without
-- the checkout math or the stock count ever being touched. That contradicted the schema's own intent
-- ("direct access is read-only for staff") and removed the one audit trail these tables exist for.
--
-- Separately, create_sale() trusted the client-supplied p_cashier_id as long as it named *some*
-- member of the shop, so any cashier could attribute their own sale to a coworker instead of
-- themselves. This migration makes create_sale() require the caller's own id unless the caller is
-- an admin or the owner.
--
-- Nothing here changes existing products, prices, stock, or past sales.

begin;

revoke insert, update, delete on public.sales, public.sale_lines, public.stock_movements from authenticated;

drop policy if exists "admins manage sales" on public.sales;
drop policy if exists "admins manage sale lines" on public.sale_lines;
drop policy if exists "admins manage stock movements" on public.stock_movements;

create or replace function public.create_sale(
  p_shop_id uuid,
  p_cashier_id uuid,
  p_customer_id uuid,
  p_payment_method public.payment_method,
  p_discount numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_row public.shops;
  sale_id uuid;
  line jsonb;
  product_row public.products%rowtype;
  unit_row public.product_units%rowtype;
  subtotal numeric(12,2) := 0;
  normalized_discount numeric(12,2) := greatest(coalesce(p_discount, 0), 0);
  quantity integer;
  unit_size integer;
  unit_price numeric(12,2);
  needed jsonb := '{}'::jsonb;   -- single items each product must supply across all lines
  needed_now integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_shop_member(p_shop_id) then raise exception 'You do not have access to this shop'; end if;
  select * into shop_row from public.shops where id = p_shop_id;

  -- The cashier on a sale is an identity, not a price: it is trusted from the client only when the
  -- caller names themselves. An admin may ring up a sale on a teammate's behalf; anyone else can only
  -- sell under their own name, so a cashier can never pin a sale on a coworker.
  if p_cashier_id is distinct from auth.uid() and not public.is_shop_admin(p_shop_id) then
    raise exception 'You can only record sales under your own name';
  end if;
  if not exists (select 1 from public.shop_members where shop_id = p_shop_id and user_id = p_cashier_id) then
    raise exception 'The cashier is not a member of this shop';
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.customers where id = p_customer_id and shop_id = p_shop_id) then
    raise exception 'Customer not found';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one sale line is required';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line ->> 'quantity')::integer;
    if quantity is null or quantity <= 0 then raise exception 'Sale quantity must be positive'; end if;

    select * into product_row
    from public.products
    where id = (line ->> 'product_id')::uuid and shop_id = p_shop_id
    for update;

    if not found then raise exception 'Product not found'; end if;

    if nullif(line ->> 'unit_id', '') is null then
      unit_size := 1;
      unit_price := product_row.selling_price;
    else
      select * into unit_row
      from public.product_units
      where id = (line ->> 'unit_id')::uuid and product_id = product_row.id and shop_id = p_shop_id;
      if not found then raise exception 'Pack size not found for %', product_row.name; end if;
      unit_size := unit_row.quantity;
      unit_price := unit_row.selling_price;
    end if;

    -- Several lines can draw on the same product (a pack and some singles), so count them together.
    needed_now := coalesce((needed ->> product_row.id::text)::integer, 0) + quantity * unit_size;
    needed := jsonb_set(needed, array[product_row.id::text], to_jsonb(needed_now));
    if product_row.stock < needed_now then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    subtotal := subtotal + (unit_price * quantity);
  end loop;

  subtotal := round(subtotal, 2);
  normalized_discount := round(least(normalized_discount, subtotal), 2);

  insert into public.sales (shop_id, cashier_id, customer_id, subtotal, discount, total, payment_method)
  values (p_shop_id, p_cashier_id, p_customer_id, subtotal, normalized_discount, subtotal - normalized_discount, p_payment_method)
  returning id into sale_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line ->> 'quantity')::integer;
    select * into product_row from public.products
    where id = (line ->> 'product_id')::uuid and shop_id = p_shop_id;

    unit_row := null;
    if nullif(line ->> 'unit_id', '') is null then
      unit_size := 1;
      unit_price := product_row.selling_price;
    else
      select * into unit_row from public.product_units where id = (line ->> 'unit_id')::uuid and shop_id = p_shop_id;
      unit_size := unit_row.quantity;
      unit_price := unit_row.selling_price;
    end if;

    insert into public.sale_lines (shop_id, sale_id, product_id, quantity, unit_price, unit_cost, unit_id, unit_name, unit_quantity)
    values (p_shop_id, sale_id, product_row.id, quantity, unit_price, round(product_row.cost_price * unit_size, 2),
            unit_row.id, unit_row.name, unit_size);
    update public.products set stock = stock - quantity * unit_size where id = product_row.id;
    insert into public.stock_movements (shop_id, product_id, type, quantity, notes)
    values (p_shop_id, product_row.id, 'out', quantity * unit_size,
            'Sale ' || sale_id::text || case when unit_size > 1 then ' (' || quantity || ' x ' || unit_row.name || ')' else '' end);
  end loop;

  if p_customer_id is not null and shop_row.loyalty_enabled then
    update public.customers
    set loyalty_points = loyalty_points + floor((subtotal - normalized_discount) / shop_row.loyalty_spend_per_point)::integer
    where id = p_customer_id;
  end if;

  return sale_id;
end;
$$;

commit;
