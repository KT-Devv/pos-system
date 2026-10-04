-- KT POS System, migration 009: retail prices.
--
-- A product can have a second, optional retail price next to its regular selling price. At the till the
-- cashier picks Regular or Retail for the whole sale; a product with no retail price is charged its
-- regular price either way, and pack sizes always use their own prices. The tier each line was charged at
-- is kept on the sale line (price_tier).
--
-- Run it once in the Supabase SQL editor on a database that already has 002-008, **before** deploying the
-- app that shows the Retail switch. It is safe to run again. Fresh installs get all of this from
-- schema.v2.sql. It changes no existing price, stock or sale: every existing product has no retail price
-- and every existing sale line is marked regular.

begin;

alter table public.products
  add column if not exists retail_price numeric(12,2);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_retail_price_check') then
    alter table public.products add constraint products_retail_price_check check (retail_price is null or retail_price > 0);
  end if;
end $$;

alter table public.sale_lines
  add column if not exists price_tier text not null default 'regular';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sale_lines_price_tier_check') then
    alter table public.sale_lines add constraint sale_lines_price_tier_check check (price_tier in ('regular', 'retail'));
  end if;
end $$;

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
  tier text;
  line_tier text;
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

    -- Retail is a second price on the product. A line asks for a tier; a product without a retail price,
    -- and every pack size (which has its own price), is simply charged its regular price.
    tier := coalesce(nullif(btrim(line ->> 'price_tier'), ''), 'regular');
    if tier not in ('regular', 'retail') then raise exception 'Unknown price tier %', tier; end if;

    if nullif(line ->> 'unit_id', '') is null then
      unit_size := 1;
      unit_price := case when tier = 'retail' and product_row.retail_price is not null then product_row.retail_price else product_row.selling_price end;
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
    tier := coalesce(nullif(btrim(line ->> 'price_tier'), ''), 'regular');
    line_tier := 'regular';
    if nullif(line ->> 'unit_id', '') is null then
      unit_size := 1;
      if tier = 'retail' and product_row.retail_price is not null then
        unit_price := product_row.retail_price;
        line_tier := 'retail';
      else
        unit_price := product_row.selling_price;
      end if;
    else
      select * into unit_row from public.product_units where id = (line ->> 'unit_id')::uuid and shop_id = p_shop_id;
      unit_size := unit_row.quantity;
      unit_price := unit_row.selling_price;
    end if;

    insert into public.sale_lines (shop_id, sale_id, product_id, quantity, unit_price, unit_cost, unit_id, unit_name, unit_quantity, price_tier)
    values (p_shop_id, sale_id, product_row.id, quantity, unit_price, round(product_row.cost_price * unit_size, 2),
            unit_row.id, unit_row.name, unit_size, line_tier);
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

-- Creates products (and their categories and pack sizes) from rows like
--   {"name": "Milk 1L", "category": "Groceries", "cost_price": 8, "selling_price": 12.5, "retail_price": 14, "stock": 20,
--    "barcode": "5901234123457", "packs": [{"name": "Pack", "quantity": 6, "selling_price": 70, "barcode": null}]}
-- A product whose name is already in the shop (ignoring case) is skipped, so uploading the same file twice
-- does not duplicate anything. Admins and the owner only, like the product form.
create or replace function public.bulk_import_products(p_shop_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  pack jsonb;
  idx integer := 0;
  prod_name text;
  cat_name text;
  cat_id uuid;
  new_id uuid;
  made_products integer := 0;
  made_packs integer := 0;
  made_categories integer := 0;
  skipped integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_shop_admin(p_shop_id) then raise exception 'Only admins can import products'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no rows to import';
  end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'Import at most 2000 products at a time'; end if;

  -- Two imports at once for the same shop would race on "already there" and on category creation.
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text, 8));

  for r in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    begin
      if jsonb_typeof(r) <> 'object' then raise exception 'Not a product row'; end if;
      prod_name := btrim(regexp_replace(coalesce(r ->> 'name', ''), '\s+', ' ', 'g'));
      if prod_name = '' or char_length(prod_name) > 120 then
        raise exception 'The product name is required, up to 120 characters';
      end if;

      if exists (select 1 from public.products where shop_id = p_shop_id and lower(name) = lower(prod_name)) then
        skipped := skipped + 1;
        continue;
      end if;

      cat_id := null;
      cat_name := nullif(btrim(regexp_replace(coalesce(r ->> 'category', ''), '\s+', ' ', 'g')), '');
      if cat_name is not null then
        if char_length(cat_name) > 80 then raise exception 'The category name is longer than 80 characters'; end if;
        select id into cat_id from public.categories where shop_id = p_shop_id and lower(name) = lower(cat_name) limit 1;
        if cat_id is null then
          insert into public.categories (shop_id, name) values (p_shop_id, cat_name) returning id into cat_id;
          made_categories := made_categories + 1;
        end if;
      end if;

      insert into public.products (shop_id, name, category_id, cost_price, selling_price, retail_price, stock, barcode)
      values (
        p_shop_id,
        prod_name,
        cat_id,
        (r ->> 'cost_price')::numeric,
        (r ->> 'selling_price')::numeric,
        nullif(r ->> 'retail_price', '')::numeric,
        coalesce((r ->> 'stock')::integer, 0),
        nullif(btrim(r ->> 'barcode'), '')
      )
      returning id into new_id;
      made_products := made_products + 1;

      if jsonb_typeof(r -> 'packs') = 'array' then
        for pack in select value from jsonb_array_elements(r -> 'packs')
        loop
          insert into public.product_units (shop_id, product_id, name, quantity, selling_price, barcode)
          values (
            p_shop_id,
            new_id,
            btrim(pack ->> 'name'),
            (pack ->> 'quantity')::integer,
            (pack ->> 'selling_price')::numeric,
            nullif(btrim(pack ->> 'barcode'), '')
          );
          made_packs := made_packs + 1;
        end loop;
      end if;
    exception when others then
      if sqlstate = '23505' and sqlerrm like '%already uses the barcode%' then
        raise exception 'Row %: %', idx, sqlerrm;
      elsif sqlstate = '23505' then
        raise exception 'Row %: a barcode, pack name or pack size is used twice', idx;
      end if;
      raise exception 'Row %: %', idx, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('products', made_products, 'packs', made_packs, 'categories', made_categories, 'skipped', skipped);
end;
$$;

commit;
