-- KT POS System, migration 006: pack sizes.
--
-- Lets a product be sold in packs, boxes, strips and so on, each with its own price, while stock stays
-- counted in single items. Run it once in the Supabase SQL editor on a database that already has
-- shops (004 and 005). It is safe to run again. Fresh installs get all of this from schema.v2.sql.
--
-- It changes nothing about existing products, prices, stock or sales.

begin;

-- Pack sizes. A product is priced per single item (products.selling_price) and its stock is counted in
-- single items. A pack size sells a fixed number of those items at its own price: "Pack of 12", "Box of
-- 24", "5 kg bag". Selling one takes `quantity` items out of stock.
create table if not exists public.product_units (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  quantity integer not null check (quantity >= 2),
  selling_price numeric(12,2) not null check (selling_price > 0),
  barcode text,
  created_at timestamptz not null default now(),
  unique (id, shop_id),
  unique (product_id, quantity),
  unique (product_id, name),
  foreign key (product_id, shop_id) references public.products(id, shop_id) on delete cascade
);
create unique index if not exists product_units_shop_barcode_key on public.product_units(shop_id, barcode) where barcode is not null;

create index if not exists product_units_shop_idx on public.product_units(shop_id);
create index if not exists product_units_product_idx on public.product_units(product_id);

-- Sales remember which pack size a line was.
alter table public.sale_lines add column if not exists unit_id uuid;
alter table public.sale_lines add column if not exists unit_name text;
alter table public.sale_lines add column if not exists unit_quantity integer not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sale_lines_unit_quantity_check' and conrelid = 'public.sale_lines'::regclass) then
    alter table public.sale_lines add constraint sale_lines_unit_quantity_check check (unit_quantity >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sale_lines_unit_id_shop_id_fkey' and conrelid = 'public.sale_lines'::regclass) then
    alter table public.sale_lines add constraint sale_lines_unit_id_shop_id_fkey
      foreign key (unit_id, shop_id) references public.product_units(id, shop_id) on delete set null (unit_id);
  end if;
end;
$$;

-- A barcode names one thing: a product or one of its pack sizes, never both, so a scan is never ambiguous.
-- (Each table's own unique index already stops repeats within it.)
create or replace function public.enforce_barcode_free()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.barcode is null then return new; end if;
  if tg_table_name = 'products' then
    if exists (select 1 from public.product_units u where u.shop_id = new.shop_id and u.barcode = new.barcode) then
      raise exception 'A pack size already uses the barcode %', new.barcode using errcode = '23505';
    end if;
  elsif exists (select 1 from public.products p where p.shop_id = new.shop_id and p.barcode = new.barcode) then
    raise exception 'A product already uses the barcode %', new.barcode using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_shop_change on public.product_units;
create trigger prevent_shop_change before update of shop_id on public.product_units for each row execute function public.prevent_shop_change();
drop trigger if exists enforce_barcode_free on public.products;
create trigger enforce_barcode_free before insert or update of barcode on public.products for each row execute function public.enforce_barcode_free();
drop trigger if exists enforce_barcode_free on public.product_units;
create trigger enforce_barcode_free before insert or update of barcode on public.product_units for each row execute function public.enforce_barcode_free();

-- Checkout. Prices and costs always come from the catalog, never from the client. Definer rights let
-- cashiers sell without holding direct write access to products, so membership is checked here.
-- A line may name a pack size (unit_id): then `quantity` counts packs, the pack's own price is charged,
-- and stock (kept in single items) goes down by quantity x the pack's size.
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

revoke all on function public.create_sale(uuid, uuid, uuid, public.payment_method, numeric, jsonb) from public, anon;
grant execute on function public.create_sale(uuid, uuid, uuid, public.payment_method, numeric, jsonb) to authenticated;

alter table public.product_units enable row level security;

drop policy if exists "members read pack sizes" on public.product_units;
create policy "members read pack sizes"
  on public.product_units for select to authenticated using (public.is_shop_member(shop_id));
drop policy if exists "admins add pack sizes" on public.product_units;
create policy "admins add pack sizes"
  on public.product_units for insert to authenticated with check (public.is_shop_admin(shop_id));
drop policy if exists "admins update pack sizes" on public.product_units;
create policy "admins update pack sizes"
  on public.product_units for update to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));
drop policy if exists "admins delete pack sizes" on public.product_units;
create policy "admins delete pack sizes"
  on public.product_units for delete to authenticated using (public.is_shop_admin(shop_id));

grant select, insert, update, delete on public.product_units to authenticated;

commit;
