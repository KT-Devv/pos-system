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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'cashier'
  );
  return new;
end;
$$;

-- Returns the caller's role without re-triggering RLS on profiles (security definer).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
create policy "authenticated users can update own profile"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Roles can only be changed by admins (blocks self-promotion through the profile update policy).
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

create policy "authenticated users can read categories"
  on public.categories for select to authenticated using (true);
create policy "admins can manage categories"
  on public.categories for insert to authenticated with check (public.is_admin());
create policy "admins can update categories"
  on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete categories"
  on public.categories for delete to authenticated using (public.is_admin());

create policy "authenticated users can read products"
  on public.products for select to authenticated using (true);
create policy "admins can add products"
  on public.products for insert to authenticated with check (public.is_admin());
create policy "admins can update products"
  on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete products"
  on public.products for delete to authenticated using (public.is_admin());

create policy "authenticated users can manage POS data"
  on public.customers for all to authenticated using (true) with check (true);
create policy "authenticated users can read sales"
  on public.sales for select to authenticated using (true);
create policy "admins can manage sales"
  on public.sales for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated users can read sale lines"
  on public.sale_lines for select to authenticated using (true);
create policy "admins can manage sale lines"
  on public.sale_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated users can manage POS data"
  on public.suppliers for all to authenticated using (true) with check (true);
create policy "authenticated users can read stock movements"
  on public.stock_movements for select to authenticated using (true);
create policy "admins can manage stock movements"
  on public.stock_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());
