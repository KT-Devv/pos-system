-- Fresh Supabase schema for the POS rewrite.
-- Apply this to a new project or after intentionally resetting the old project.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'cashier');
create type public.payment_method as enum ('cash', 'momo', 'card');
create type public.stock_movement_type as enum ('in', 'out', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role public.user_role not null default 'cashier',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price > 0),
  stock integer not null default 0 check (stock >= 0),
  barcode text unique,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method public.payment_method not null,
  created_at timestamptz not null default now()
);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type public.stock_movement_type not null,
  quantity integer not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products(category_id);
create index products_barcode_idx on public.products(barcode);
create index sales_created_at_idx on public.sales(created_at);
create index sale_lines_sale_id_idx on public.sale_lines(sale_id);
create index stock_movements_product_id_idx on public.stock_movements(product_id);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_movements enable row level security;

create policy "authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);
create policy "authenticated users can manage POS data"
  on public.categories for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.products for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.customers for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.sales for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.sale_lines for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.suppliers for all to authenticated using (true) with check (true);
create policy "authenticated users can manage POS data"
  on public.stock_movements for all to authenticated using (true) with check (true);
