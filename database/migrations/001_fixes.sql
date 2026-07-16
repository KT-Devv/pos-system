-- Migration for existing Supabase projects
-- Run in SQL Editor after the initial schema

-- Drop old permissive policies if they exist
drop policy if exists "Allow authenticated users full access to users" on public.users;
drop policy if exists "Allow authenticated users full access to categories" on public.categories;
drop policy if exists "Allow authenticated users full access to products" on public.products;
drop policy if exists "Allow authenticated users full access to suppliers" on public.suppliers;
drop policy if exists "Allow authenticated users full access to sales" on public.sales;
drop policy if exists "Allow authenticated users full access to sale_items" on public.sale_items;
drop policy if exists "Allow authenticated users full access to stock_history" on public.stock_history;
drop policy if exists "Allow authenticated users full access to expenses" on public.expenses;
drop policy if exists "Allow authenticated users full access to customers" on public.customers;

-- Fix stock_history quantity constraint (positive quantities only)
alter table public.stock_history drop constraint if exists stock_history_quantity_check;
alter table public.stock_history add constraint stock_history_quantity_check check (quantity > 0);

-- Role helper
create or replace function public.get_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.users where id = auth.uid(); $$;

-- New RLS policies (skip if already applied)
do $$ begin
  create policy "users_select_own" on public.users for select using (auth.uid() = id or not exists(select 1 from public.users));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users_select_admin" on public.users for select using (public.get_user_role() = 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users_insert_own" on public.users for insert with check (auth.uid() = id and ((role = 'cashier') or (role = 'admin' and not exists(select 1 from public.users))));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users_update_admin" on public.users for update using (public.get_user_role() = 'admin');
exception when duplicate_object then null; end $$;

-- Replace stock triggers with validated versions
create or replace function update_product_stock()
returns trigger as $$
declare current_stock integer;
begin
  select stock into current_stock from public.products where id = NEW.product_id for update;
  if current_stock is null then raise exception 'Product not found'; end if;
  if current_stock < NEW.quantity then raise exception 'Insufficient stock'; end if;
  update public.products set stock = stock - NEW.quantity where id = NEW.product_id;
  return NEW;
end;
$$ language plpgsql;

create or replace function update_stock_on_entry()
returns trigger as $$
declare current_stock integer;
begin
  if NEW.type = 'in' then
    update public.products set stock = stock + NEW.quantity where id = NEW.product_id;
  elsif NEW.type = 'out' then
    select stock into current_stock from public.products where id = NEW.product_id for update;
    if current_stock < NEW.quantity then raise exception 'Insufficient stock'; end if;
    update public.products set stock = stock - NEW.quantity where id = NEW.product_id;
  elsif NEW.type = 'adjustment' then
    select stock into current_stock from public.products where id = NEW.product_id for update;
    if current_stock + NEW.quantity < 0 then raise exception 'Stock cannot go negative'; end if;
    update public.products set stock = stock + NEW.quantity where id = NEW.product_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Atomic sale RPC
create or replace function public.create_sale(
  p_cashier_id uuid, p_total numeric, p_discount numeric, p_payment_method text, p_items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid; v_item jsonb; v_product_stock integer; v_subtotal numeric := 0;
begin
  if p_discount < 0 or p_total < 0 then raise exception 'Invalid amounts'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select stock into v_product_stock from products where id = (v_item->>'product_id')::uuid for update;
    if v_product_stock is null then raise exception 'Product not found'; end if;
    if v_product_stock < (v_item->>'quantity')::integer then raise exception 'Insufficient stock'; end if;
    v_subtotal := v_subtotal + (v_item->>'price')::numeric * (v_item->>'quantity')::integer;
  end loop;
  if p_discount > v_subtotal or abs(p_total - (v_subtotal - p_discount)) > 0.01 then
    raise exception 'Invalid total or discount';
  end if;
  insert into sales (cashier_id, total, discount, payment_method)
  values (p_cashier_id, p_total, p_discount, p_payment_method) returning id into v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items (sale_id, product_id, quantity, price, cost_price)
    values (v_sale_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric, (v_item->>'cost_price')::numeric);
  end loop;
  return v_sale_id;
end; $$;

grant execute on function public.create_sale(uuid, numeric, numeric, text, jsonb) to authenticated;

-- Downgrade any self-assigned admin accounts created by the bug (optional, review first)
-- update public.users set role = 'cashier' where role = 'admin' and email not like '%@yourdomain.com';
