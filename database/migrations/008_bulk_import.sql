-- KT POS System, migration 008: bulk entry of products and stock.
--
-- Adds bulk_import_products() and bulk_record_stock(), the two functions behind the Import buttons on
-- Products and Inventory. Run it once in the Supabase SQL editor on a database that already has 002-007.
-- It is safe to run again. Fresh installs get all of this from schema.v2.sql. It changes no existing data.
--
-- Both are all-or-nothing: if any row is rejected the whole batch is rolled back and the error names the
-- row ("Row 7: ..."), so a half-imported file can never be left behind. The screen checks the file first
-- for friendlier messages, but these functions re-check everything, because a client can call them
-- with anything.

begin;

-- Creates products (and their categories and pack sizes) from rows like
--   {"name": "Milk 1L", "category": "Groceries", "cost_price": 8, "selling_price": 12.5, "stock": 20,
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

      insert into public.products (shop_id, name, category_id, cost_price, selling_price, stock, barcode)
      values (
        p_shop_id,
        prod_name,
        cat_id,
        (r ->> 'cost_price')::numeric,
        (r ->> 'selling_price')::numeric,
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

-- Records many stock movements at once, in file order, through record_stock_movement() so every rule
-- there (no negative stock, supplier must belong to the shop, recounts) applies row by row.
-- Rows look like {"product_id": "...", "type": "in", "quantity": 48, "supplier_id": null, "notes": "..."}.
-- Any member may do this, as with the single-movement form.
create or replace function public.bulk_record_stock(p_shop_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  idx integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_shop_member(p_shop_id) then raise exception 'You do not have access to this shop'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no rows to import';
  end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'Import at most 2000 rows at a time'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text, 9));

  for r in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    begin
      if jsonb_typeof(r) <> 'object' then raise exception 'Not a stock row'; end if;
      if not exists (
        select 1 from public.products where id = (r ->> 'product_id')::uuid and shop_id = p_shop_id
      ) then
        raise exception 'Product not found';
      end if;
      perform public.record_stock_movement(
        (r ->> 'product_id')::uuid,
        (r ->> 'type')::public.stock_movement_type,
        (r ->> 'quantity')::integer,
        nullif(r ->> 'supplier_id', '')::uuid,
        nullif(left(btrim(coalesce(r ->> 'notes', '')), 500), '')
      );
    exception when others then
      raise exception 'Row %: %', idx, sqlerrm;
    end;
  end loop;

  return idx;
end;
$$;

revoke all on function public.bulk_import_products(uuid, jsonb) from public, anon;
grant execute on function public.bulk_import_products(uuid, jsonb) to authenticated;
revoke all on function public.bulk_record_stock(uuid, jsonb) from public, anon;
grant execute on function public.bulk_record_stock(uuid, jsonb) to authenticated;

commit;
