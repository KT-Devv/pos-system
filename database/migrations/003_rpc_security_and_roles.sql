-- Fixes found by running the schema against a real Postgres as cashier / admin / anonymous:
--
--   1. Cashiers could not complete a sale. create_sale and record_stock_movement ran as the
--      caller ("security invoker"), and migration 002 made products writable by admins only, so
--      `select ... for update` / `update products` found no rows ("Product not found").
--      The functions now run with definer rights and do their own checks.
--   2. Any signed-in user could set their own profiles.role to 'admin'. A trigger now blocks
--      role changes unless the caller is an admin (SQL editor / service role are unaffected).
--   3. Sales history and stock movements were editable and deletable by every signed-in user.
--      They are now read-only for non-admins; rows are only written through the RPCs.
--   4. Admins had no way to change another user's role through the API.
--   5. Stock could not be recounted to zero (adjustment quantity had to be > 0).
--
-- Apply after 002. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1 + 5. RPCs: definer rights, explicit auth check, recount to zero
-- ---------------------------------------------------------------------------
create or replace function public.create_sale(
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
  sale_id uuid;
  line jsonb;
  product_row public.products%rowtype;
  subtotal numeric(12,2) := 0;
  normalized_discount numeric(12,2) := greatest(coalesce(p_discount, 0), 0);
  quantity integer;
  unit_price numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one sale line is required';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line ->> 'quantity')::integer;
    if quantity <= 0 then raise exception 'Sale quantity must be positive'; end if;

    select * into product_row
    from public.products
    where id = (line ->> 'product_id')::uuid
    for update;

    if not found then raise exception 'Product not found'; end if;
    if product_row.stock < quantity then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    unit_price := product_row.selling_price;
    subtotal := subtotal + (unit_price * quantity);
  end loop;

  subtotal := round(subtotal, 2);
  normalized_discount := round(least(normalized_discount, subtotal), 2);

  insert into public.sales (cashier_id, customer_id, subtotal, discount, total, payment_method)
  values (p_cashier_id, p_customer_id, subtotal, normalized_discount, subtotal - normalized_discount, p_payment_method)
  returning id into sale_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line ->> 'quantity')::integer;
    select * into product_row from public.products where id = (line ->> 'product_id')::uuid;
    insert into public.sale_lines (sale_id, product_id, quantity, unit_price, unit_cost)
    values (sale_id, product_row.id, quantity, product_row.selling_price, product_row.cost_price);
    update public.products set stock = stock - quantity where id = product_row.id;
    insert into public.stock_movements (product_id, type, quantity, notes)
    values (product_row.id, 'out', quantity, 'Sale ' || sale_id::text);
  end loop;

  if p_customer_id is not null then
    update public.customers
    set loyalty_points = loyalty_points + floor((subtotal - normalized_discount) / 10)::integer
    where id = p_customer_id;
  end if;

  return sale_id;
end;
$$;

create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_type public.stock_movement_type,
  p_quantity integer,
  p_supplier_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  movement_quantity integer := p_quantity;
  movement_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if p_type = 'adjustment' then
    if p_quantity < 0 then raise exception 'Counted stock cannot be negative'; end if;
  elsif p_quantity <= 0 then
    raise exception 'Stock quantity must be positive';
  end if;

  select * into product_row
  from public.products
  where id = p_product_id
  for update;
  if not found then raise exception 'Product not found'; end if;

  if p_type = 'in' then
    update public.products set stock = stock + p_quantity where id = p_product_id;
  elsif p_type = 'out' then
    if product_row.stock < p_quantity then raise exception 'Insufficient stock'; end if;
    update public.products set stock = stock - p_quantity where id = p_product_id;
  else
    movement_quantity := p_quantity - product_row.stock;
    update public.products set stock = p_quantity where id = p_product_id;
  end if;

  insert into public.stock_movements (product_id, type, quantity, supplier_id, notes)
  values (p_product_id, p_type, movement_quantity, p_supplier_id, p_notes)
  returning id into movement_id;
  return movement_id;
end;
$$;

-- Definer functions must not be callable by anonymous visitors.
revoke all on function public.create_sale(uuid, uuid, public.payment_method, numeric, jsonb) from public, anon;
grant execute on function public.create_sale(uuid, uuid, public.payment_method, numeric, jsonb) to authenticated;
revoke all on function public.record_stock_movement(uuid, public.stock_movement_type, integer, uuid, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, public.stock_movement_type, integer, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2 + 4. Roles can only be changed by admins
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL editor / service role, which may always change roles.
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update of role on public.profiles
  for each row execute function public.protect_profile_role();

drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Sales history and stock movements: read for everyone, direct writes for admins only
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated users can manage POS data" on public.sales;
drop policy if exists "authenticated users can read sales" on public.sales;
drop policy if exists "admins can manage sales" on public.sales;
create policy "authenticated users can read sales"
  on public.sales for select to authenticated using (true);
create policy "admins can manage sales"
  on public.sales for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated users can manage POS data" on public.sale_lines;
drop policy if exists "authenticated users can read sale lines" on public.sale_lines;
drop policy if exists "admins can manage sale lines" on public.sale_lines;
create policy "authenticated users can read sale lines"
  on public.sale_lines for select to authenticated using (true);
create policy "admins can manage sale lines"
  on public.sale_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated users can manage POS data" on public.stock_movements;
drop policy if exists "authenticated users can read stock movements" on public.stock_movements;
drop policy if exists "admins can manage stock movements" on public.stock_movements;
create policy "authenticated users can read stock movements"
  on public.stock_movements for select to authenticated using (true);
create policy "admins can manage stock movements"
  on public.stock_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());
