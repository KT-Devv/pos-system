-- POS System Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text unique not null,
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Categories table
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products table
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

-- Suppliers table
create table public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales table
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  cashier_id uuid references public.users(id) on delete restrict not null,
  total numeric(10, 2) not null check (total >= 0),
  discount numeric(10, 2) default 0 check (discount >= 0),
  payment_method text not null check (payment_method in ('cash', 'momo', 'card')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sale Items table
create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict not null,
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  cost_price numeric(10, 2) not null check (cost_price >= 0)
);

-- Stock History table
create table public.stock_history (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expenses table
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Customers table
create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  loyalty_points integer default 0 check (loyalty_points >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for better performance
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

-- Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_history enable row level security;
alter table public.expenses enable row level security;
alter table public.customers enable row level security;

-- Policies (basic - adjust based on your auth needs)
-- For now, allow authenticated users full access
create policy "Allow authenticated users full access to users" on public.users for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to categories" on public.categories for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to products" on public.products for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to suppliers" on public.suppliers for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to sales" on public.sales for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to sale_items" on public.sale_items for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to stock_history" on public.stock_history for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to expenses" on public.expenses for all using (auth.role() = 'authenticated');
create policy "Allow authenticated users full access to customers" on public.customers for all using (auth.role() = 'authenticated');

-- Function to update product stock after sale
create or replace function update_product_stock()
returns trigger as $$
begin
  update public.products
  set stock = stock - NEW.quantity
  where id = NEW.product_id;
  return NEW;
end;
$$ language plpgsql;

-- Trigger to update stock on sale item insert
create trigger on_sale_item_insert
  after insert on public.sale_items
  for each row
  execute function update_product_stock();

-- Function to update product stock on stock in
create or replace function update_stock_on_entry()
returns trigger as $$
begin
  if NEW.type = 'in' then
    update public.products
    set stock = stock + NEW.quantity
    where id = NEW.product_id;
  elsif NEW.type = 'out' then
    update public.products
    set stock = stock - NEW.quantity
    where id = NEW.product_id;
  elsif NEW.type = 'adjustment' then
    update public.products
    set stock = stock + NEW.quantity
    where id = NEW.product_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Trigger to update stock on stock history insert
create trigger on_stock_history_insert
  after insert on public.stock_history
  for each row
  execute function update_stock_on_entry();

-- Insert default categories
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
