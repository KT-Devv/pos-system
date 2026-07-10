-- POS System Database Schema
-- Run this in Supabase SQL Editor for new projects.
-- Existing projects: also run database/migrations/001_fixes.sql

create extension if not exists "uuid-ossp";

create table public.users (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text unique not null,
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  cost_price numeric(10, 2) not null check (cost_price >= 0),
  selling_price numeric(10, 2) not null check (selling_price > 0),
  stock integer not null default 0 check (stock >= 0),
  barcode text unique,
  image text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  cashier_id uuid references public.users(id) on delete restrict not null,
  total numeric(10, 2) not null check (total >= 0),
  discount numeric(10, 2) default 0 check (discount >= 0),
  payment_method text not null check (payment_method in ('cash', 'momo', 'card')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict not null,
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  cost_price numeric(10, 2) not null check (cost_price >= 0)
);

create table public.stock_history (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null check (quantity > 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  loyalty_points integer default 0 check (loyalty_points >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_products_category on public.products(category_id);
create index idx_products_barcode on public.products(barcode);
create index idx_products_name on public.products(name);
create index idx_sales_cashier on public.sales(cashier_id);
create index idx_sales_created on public.sales(created_at);
create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);
create index idx_stock_history_product on public.stock_history(product_id);
create index idx_stock_history_created on public.stock_history(created_at);
create index idx_customers_phone on public.customers(phone);

-- Role helper for RLS
create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_history enable row level security;
alter table public.expenses enable row level security;
alter table public.customers enable row level security;

-- Users: read own profile; admins manage all
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_select_admin" on public.users for select using (public.get_user_role() = 'admin');
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id and role = 'cashier');
create policy "users_update_admin" on public.users for update using (public.get_user_role() = 'admin');

-- Categories, suppliers, expenses: admin only for writes
create policy "categories_select" on public.categories for select using (auth.role() = 'authenticated');
create policy "categories_admin" on public.categories for all using (public.get_user_role() = 'admin');

create policy "suppliers_select" on public.suppliers for select using (auth.role() = 'authenticated');
create policy "suppliers_admin" on public.suppliers for all using (public.get_user_role() = 'admin');

create policy "expenses_select" on public.expenses for select using (auth.role() = 'authenticated');
create policy "expenses_admin" on public.expenses for all using (public.get_user_role() = 'admin');

-- Products: all read; admin write
create policy "products_select" on public.products for select using (auth.role() = 'authenticated');
create policy "products_admin" on public.products for all using (public.get_user_role() = 'admin');

-- Sales: authenticated can create and read
create policy "sales_select" on public.sales for select using (auth.role() = 'authenticated');
create policy "sales_insert" on public.sales for insert with check (auth.role() = 'authenticated');

create policy "sale_items_select" on public.sale_items for select using (auth.role() = 'authenticated');
create policy "sale_items_insert" on public.sale_items for insert with check (auth.role() = 'authenticated');

-- Stock history: admin only
create policy "stock_history_select" on public.stock_history for select using (auth.role() = 'authenticated');
create policy "stock_history_admin" on public.stock_history for all using (public.get_user_role() = 'admin');

-- Customers: all authenticated
create policy "customers_select" on public.customers for select using (auth.role() = 'authenticated');
create policy "customers_insert" on public.customers for insert with check (auth.role() = 'authenticated');
create policy "customers_update" on public.customers for update using (auth.role() = 'authenticated');
create policy "customers_delete_admin" on public.customers for delete using (public.get_user_role() = 'admin');

-- Stock update on sale with validation
create or replace function update_product_stock()
returns trigger as $$
declare
  current_stock integer;
begin
  select stock into current_stock from public.products where id = NEW.product_id for update;
  if current_stock is null then
    raise exception 'Product not found';
  end if;
  if current_stock < NEW.quantity then
    raise exception 'Insufficient stock for product %', NEW.product_id;
  end if;
  update public.products set stock = stock - NEW.quantity where id = NEW.product_id;
  return NEW;
end;
$$ language plpgsql;

create trigger on_sale_item_insert
  after insert on public.sale_items
  for each row
  execute function update_product_stock();

create or replace function update_stock_on_entry()
returns trigger as $$
declare
  current_stock integer;
begin
  if NEW.type = 'in' then
    update public.products set stock = stock + NEW.quantity where id = NEW.product_id;
  elsif NEW.type = 'out' then
    select stock into current_stock from public.products where id = NEW.product_id for update;
    if current_stock < NEW.quantity then
      raise exception 'Insufficient stock';
    end if;
    update public.products set stock = stock - NEW.quantity where id = NEW.product_id;
  elsif NEW.type = 'adjustment' then
    select stock into current_stock from public.products where id = NEW.product_id for update;
    if current_stock + NEW.quantity < 0 then
      raise exception 'Stock cannot go negative';
    end if;
    update public.products set stock = stock + NEW.quantity where id = NEW.product_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger on_stock_history_insert
  after insert on public.stock_history
  for each row
  execute function update_stock_on_entry();

-- Atomic sale creation RPC
create or replace function public.create_sale(
  p_cashier_id uuid,
  p_total numeric,
  p_discount numeric,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product_stock integer;
  v_subtotal numeric := 0;
begin
  if p_discount < 0 then raise exception 'Discount cannot be negative'; end if;
  if p_total < 0 then raise exception 'Total cannot be negative'; end if;
  if p_payment_method not in ('cash', 'momo', 'card') then raise exception 'Invalid payment method'; end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select stock into v_product_stock from products where id = (v_item->>'product_id')::uuid for update;
    if v_product_stock is null then raise exception 'Product not found'; end if;
    if v_product_stock < (v_item->>'quantity')::integer then raise exception 'Insufficient stock'; end if;
    v_subtotal := v_subtotal + (v_item->>'price')::numeric * (v_item->>'quantity')::integer;
  end loop;

  if p_total > v_subtotal then raise exception 'Total exceeds subtotal'; end if;
  if p_discount > v_subtotal then raise exception 'Discount exceeds subtotal'; end if;
  if abs(p_total - (v_subtotal - p_discount)) > 0.01 then raise exception 'Total does not match subtotal minus discount'; end if;

  insert into sales (cashier_id, total, discount, payment_method)
  values (p_cashier_id, p_total, p_discount, p_payment_method)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into sale_items (sale_id, product_id, quantity, price, cost_price)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric,
      (v_item->>'cost_price')::numeric
    );
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function public.create_sale(uuid, numeric, numeric, text, jsonb) to authenticated;

insert into public.categories (name) values
  ('Dairy'),
  ('Bakery'),
  ('Grains'),
  ('Cooking'),
  ('Beverages'),
  ('Personal Care'),
  ('Cleaning'),
  ('Snacks'),
  ('Canned Goods'),
  ('Stationery');
