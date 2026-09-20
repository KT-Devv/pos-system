-- KT POS System: multi-tenant Supabase schema.
--
-- Every shop is a tenant. Users sign up, create a shop on first login (create_shop), and can invite
-- staff by email. All business data carries a shop_id; row-level security limits every query to the
-- shops the caller belongs to, and composite foreign keys make it impossible for a row to reference
-- data from another shop.
--
-- Fresh projects: run this file once.
-- Existing single-shop projects: run database/migrations/004_multi_tenant_shops.sql instead.

create extension if not exists "pgcrypto";

-- @@ tables ------------------------------------------------------------------------------------

create type public.shop_role as enum ('owner', 'admin', 'cashier');
create type public.payment_method as enum ('cash', 'momo', 'card');
create type public.stock_movement_type as enum ('in', 'out', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- ISO 4217. Only 0- and 2-decimal currencies are supported (amounts are numeric(12,2)).
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  phone text,
  email text,
  address text,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  loyalty_enabled boolean not null default true,
  -- Customers earn one loyalty point for every this-many currency units spent.
  loyalty_spend_per_point numeric(12,2) not null default 10 check (loyalty_spend_per_point > 0),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.shop_role not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id),
  -- One shop per account for now. Drop this constraint to allow people to work in several shops.
  unique (user_id)
);
create unique index shop_members_one_owner_idx on public.shop_members(shop_id) where role = 'owner';

create table public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.shop_role not null check (role in ('admin', 'cashier')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  unique (shop_id, email)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, name),
  unique (id, shop_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  category_id uuid,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price > 0),
  stock integer not null default 0 check (stock >= 0),
  barcode text,
  image_url text,
  created_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (category_id, shop_id) references public.categories(id, shop_id) on delete set null (category_id)
);
create unique index products_shop_barcode_key on public.products(shop_id, barcode) where barcode is not null;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method public.payment_method not null,
  created_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (customer_id, shop_id) references public.customers(id, shop_id) on delete set null (customer_id)
);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  foreign key (sale_id, shop_id) references public.sales(id, shop_id) on delete cascade,
  foreign key (product_id, shop_id) references public.products(id, shop_id) on delete restrict
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null,
  type public.stock_movement_type not null,
  quantity integer not null,
  supplier_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (product_id, shop_id) references public.products(id, shop_id) on delete cascade,
  foreign key (supplier_id, shop_id) references public.suppliers(id, shop_id) on delete set null (supplier_id)
);

-- @@ indexes ------------------------------------------------------------------------------------

create index if not exists products_shop_idx on public.products(shop_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists categories_shop_idx on public.categories(shop_id);
create index if not exists customers_shop_idx on public.customers(shop_id);
create index if not exists suppliers_shop_idx on public.suppliers(shop_id);
create index if not exists sales_shop_created_at_idx on public.sales(shop_id, created_at);
create index if not exists sale_lines_shop_idx on public.sale_lines(shop_id);
create index if not exists sale_lines_sale_id_idx on public.sale_lines(sale_id);
create index if not exists stock_movements_shop_idx on public.stock_movements(shop_id);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);
create index if not exists shop_invites_email_idx on public.shop_invites(email);

-- @@ tenancy-functions --------------------------------------------------------------------------

-- New auth users get a profile. They join or create a shop on first login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User'),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- The helpers below are security definer so policies can consult shop_members without recursing
-- into its own row-level security.
create or replace function public.shop_role_of(p_shop uuid)
returns public.shop_role
language sql stable security definer set search_path = public
as $$
  select role from public.shop_members where shop_id = p_shop and user_id = auth.uid();
$$;

create or replace function public.is_shop_member(p_shop uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.shop_members where shop_id = p_shop and user_id = auth.uid());
$$;

create or replace function public.is_shop_admin(p_shop uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_shop_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members mine
    join public.shop_members theirs on theirs.shop_id = mine.shop_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

-- @@ triggers -----------------------------------------------------------------------------------

-- Ownership never changes, and the currency is locked once the shop has recorded sales (changing it
-- would silently reinterpret every historic amount). The SQL editor / service role is exempt.
create or replace function public.guard_shop_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'The shop owner cannot be changed';
    end if;
    if new.currency is distinct from old.currency
       and exists (select 1 from public.sales where shop_id = old.id) then
      raise exception 'The currency cannot be changed after sales have been recorded';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shop_update on public.shops;
create trigger guard_shop_update
  before update on public.shops
  for each row execute function public.guard_shop_update();

-- A row can never be moved to another shop.
create or replace function public.prevent_shop_change()
returns trigger
language plpgsql
as $$
begin
  if new.shop_id is distinct from old.shop_id then
    raise exception 'shop_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_shop_change on public.categories;
create trigger prevent_shop_change before update of shop_id on public.categories for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.products;
create trigger prevent_shop_change before update of shop_id on public.products for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.customers;
create trigger prevent_shop_change before update of shop_id on public.customers for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.suppliers;
create trigger prevent_shop_change before update of shop_id on public.suppliers for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.sales;
create trigger prevent_shop_change before update of shop_id on public.sales for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.sale_lines;
create trigger prevent_shop_change before update of shop_id on public.sale_lines for each row execute function public.prevent_shop_change();
drop trigger if exists prevent_shop_change on public.stock_movements;
create trigger prevent_shop_change before update of shop_id on public.stock_movements for each row execute function public.prevent_shop_change();

-- @@ rpc ----------------------------------------------------------------------------------------

-- First-login onboarding: creates the shop and makes the caller its owner.
create or replace function public.create_shop(
  p_name text,
  p_currency text,
  p_country text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_low_stock_threshold integer default 5,
  p_loyalty_enabled boolean default true,
  p_loyalty_spend_per_point numeric default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.shop_members where user_id = auth.uid()) then
    raise exception 'You already belong to a shop';
  end if;

  insert into public.shops (
    name, currency, country, phone, email, address,
    low_stock_threshold, loyalty_enabled, loyalty_spend_per_point, owner_id
  ) values (
    btrim(p_name), upper(btrim(p_currency)), nullif(upper(btrim(p_country)), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_email), ''), nullif(btrim(p_address), ''),
    p_low_stock_threshold, p_loyalty_enabled, p_loyalty_spend_per_point, auth.uid()
  ) returning id into new_id;

  insert into public.shop_members (shop_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

-- Team management. Owners can invite admins and cashiers; admins can invite cashiers.
create or replace function public.invite_member(p_shop_id uuid, p_email text, p_role public.shop_role)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.shop_role := public.shop_role_of(p_shop_id);
  clean text := lower(btrim(p_email));
  invite_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if actor is null or actor = 'cashier' then raise exception 'Only admins can invite people'; end if;
  if p_role = 'owner' then raise exception 'A shop has exactly one owner'; end if;
  if p_role = 'admin' and actor <> 'owner' then raise exception 'Only the owner can invite admins'; end if;
  if clean !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if exists (
    select 1 from public.profiles p
    join public.shop_members m on m.user_id = p.id
    where lower(p.email) = clean
  ) then
    raise exception 'That person already belongs to a shop';
  end if;

  insert into public.shop_invites (shop_id, email, role, invited_by)
  values (p_shop_id, clean, p_role, auth.uid())
  on conflict (shop_id, email) do update
    set role = excluded.role, invited_by = excluded.invited_by,
        created_at = now(), expires_at = now() + interval '14 days'
  returning id into invite_id;
  return invite_id;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop uuid;
begin
  select shop_id into target_shop from public.shop_invites where id = p_invite_id;
  if target_shop is null or not public.is_shop_admin(target_shop) then
    raise exception 'Invitation not found';
  end if;
  delete from public.shop_invites where id = p_invite_id;
end;
$$;

-- Invitations addressed to the signed-in user's email (they are not members yet, so RLS can't show them).
create or replace function public.my_invites()
returns table (invite_id uuid, shop_id uuid, shop_name text, role public.shop_role, invited_by_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.shop_id, s.name, i.role, p.name, i.expires_at
  from public.shop_invites i
  join public.shops s on s.id = i.shop_id
  left join public.profiles p on p.id = i.invited_by
  where auth.uid() is not null
    and i.email = lower(auth.jwt() ->> 'email')
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.shop_invites;
  my_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into inv from public.shop_invites where id = p_invite_id;
  if not found or inv.email is distinct from my_email or inv.expires_at < now() then
    raise exception 'This invitation is no longer valid';
  end if;
  if exists (select 1 from public.shop_members where user_id = auth.uid()) then
    raise exception 'You already belong to a shop';
  end if;

  insert into public.shop_members (shop_id, user_id, role) values (inv.shop_id, auth.uid(), inv.role);
  -- One shop per account: any other open invitations for this address are now moot.
  delete from public.shop_invites where email = my_email;
  return inv.shop_id;
end;
$$;

create or replace function public.set_member_role(p_shop_id uuid, p_user_id uuid, p_role public.shop_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.shop_role_of(p_shop_id) is distinct from 'owner' then
    raise exception 'Only the owner can change roles';
  end if;
  if p_role = 'owner' then raise exception 'A shop has exactly one owner'; end if;
  update public.shop_members set role = p_role
  where shop_id = p_shop_id and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'Member not found'; end if;
end;
$$;

create or replace function public.remove_member(p_shop_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.shop_role := public.shop_role_of(p_shop_id);
  target public.shop_role;
begin
  if actor is null or actor = 'cashier' then raise exception 'Only admins can remove people'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  select role into target from public.shop_members where shop_id = p_shop_id and user_id = p_user_id;
  if target is null then raise exception 'Member not found'; end if;
  if target = 'owner' then raise exception 'The owner cannot be removed'; end if;
  if target = 'admin' and actor <> 'owner' then raise exception 'Only the owner can remove admins'; end if;
  delete from public.shop_members where shop_id = p_shop_id and user_id = p_user_id;
end;
$$;

-- Checkout. Prices and costs always come from the catalog, never from the client. Definer rights let
-- cashiers sell without holding direct write access to products, so membership is checked here.
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
  subtotal numeric(12,2) := 0;
  normalized_discount numeric(12,2) := greatest(coalesce(p_discount, 0), 0);
  quantity integer;
  unit_price numeric(12,2);
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
    if quantity <= 0 then raise exception 'Sale quantity must be positive'; end if;

    select * into product_row
    from public.products
    where id = (line ->> 'product_id')::uuid and shop_id = p_shop_id
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

  insert into public.sales (shop_id, cashier_id, customer_id, subtotal, discount, total, payment_method)
  values (p_shop_id, p_cashier_id, p_customer_id, subtotal, normalized_discount, subtotal - normalized_discount, p_payment_method)
  returning id into sale_id;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    quantity := (line ->> 'quantity')::integer;
    select * into product_row from public.products
    where id = (line ->> 'product_id')::uuid and shop_id = p_shop_id;
    insert into public.sale_lines (shop_id, sale_id, product_id, quantity, unit_price, unit_cost)
    values (p_shop_id, sale_id, product_row.id, quantity, product_row.selling_price, product_row.cost_price);
    update public.products set stock = stock - quantity where id = product_row.id;
    insert into public.stock_movements (shop_id, product_id, type, quantity, notes)
    values (p_shop_id, product_row.id, 'out', quantity, 'Sale ' || sale_id::text);
  end loop;

  if p_customer_id is not null and shop_row.loyalty_enabled then
    update public.customers
    set loyalty_points = loyalty_points + floor((subtotal - normalized_discount) / shop_row.loyalty_spend_per_point)::integer
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
  target_shop uuid;
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

  -- Resolve the shop and check membership before locking anything, and answer "not found" for
  -- other shops' products so their existence is not revealed.
  select shop_id into target_shop from public.products where id = p_product_id;
  if target_shop is null or not public.is_shop_member(target_shop) then
    raise exception 'Product not found';
  end if;
  if p_supplier_id is not null
     and not exists (select 1 from public.suppliers where id = p_supplier_id and shop_id = target_shop) then
    raise exception 'Supplier not found';
  end if;

  select * into product_row from public.products where id = p_product_id for update;

  if p_type = 'in' then
    update public.products set stock = stock + p_quantity where id = p_product_id;
  elsif p_type = 'out' then
    if product_row.stock < p_quantity then raise exception 'Insufficient stock'; end if;
    update public.products set stock = stock - p_quantity where id = p_product_id;
  else
    movement_quantity := p_quantity - product_row.stock;
    update public.products set stock = p_quantity where id = p_product_id;
  end if;

  insert into public.stock_movements (shop_id, product_id, type, quantity, supplier_id, notes)
  values (target_shop, p_product_id, p_type, movement_quantity, p_supplier_id, p_notes)
  returning id into movement_id;
  return movement_id;
end;
$$;

-- Only signed-in users may call the RPCs.
revoke all on function public.create_shop(text, text, text, text, text, text, integer, boolean, numeric) from public, anon;
grant execute on function public.create_shop(text, text, text, text, text, text, integer, boolean, numeric) to authenticated;
revoke all on function public.invite_member(uuid, text, public.shop_role) from public, anon;
grant execute on function public.invite_member(uuid, text, public.shop_role) to authenticated;
revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
revoke all on function public.set_member_role(uuid, uuid, public.shop_role) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, public.shop_role) to authenticated;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
revoke all on function public.create_sale(uuid, uuid, uuid, public.payment_method, numeric, jsonb) from public, anon;
grant execute on function public.create_sale(uuid, uuid, uuid, public.payment_method, numeric, jsonb) to authenticated;
revoke all on function public.record_stock_movement(uuid, public.stock_movement_type, integer, uuid, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, public.stock_movement_type, integer, uuid, text) to authenticated;

-- @@ policies -----------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_invites enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.stock_movements enable row level security;

-- Profiles: you and the people you work with. People can rename themselves but nothing else.
revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;
create policy "read own and teammates' profiles"
  on public.profiles for select to authenticated using (id = auth.uid() or public.shares_shop_with(id));
create policy "update own profile"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Shops are created through create_shop(); members can read, owners and admins can edit settings.
create policy "members read their shop"
  on public.shops for select to authenticated using (public.is_shop_member(id));
create policy "admins update their shop"
  on public.shops for update to authenticated using (public.is_shop_admin(id)) with check (public.is_shop_admin(id));

-- Membership and invitations change only through the RPCs above.
create policy "members read the team"
  on public.shop_members for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins read invitations"
  on public.shop_invites for select to authenticated using (public.is_shop_admin(shop_id));

-- Catalog: everyone in the shop reads it, owners and admins change it.
create policy "members read categories"
  on public.categories for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins add categories"
  on public.categories for insert to authenticated with check (public.is_shop_admin(shop_id));
create policy "admins update categories"
  on public.categories for update to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));
create policy "admins delete categories"
  on public.categories for delete to authenticated using (public.is_shop_admin(shop_id));

create policy "members read products"
  on public.products for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins add products"
  on public.products for insert to authenticated with check (public.is_shop_admin(shop_id));
create policy "admins update products"
  on public.products for update to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));
create policy "admins delete products"
  on public.products for delete to authenticated using (public.is_shop_admin(shop_id));

-- Customers and suppliers: any member can add and edit, only admins can delete.
create policy "members read customers"
  on public.customers for select to authenticated using (public.is_shop_member(shop_id));
create policy "members add customers"
  on public.customers for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "members update customers"
  on public.customers for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "admins delete customers"
  on public.customers for delete to authenticated using (public.is_shop_admin(shop_id));

create policy "members read suppliers"
  on public.suppliers for select to authenticated using (public.is_shop_member(shop_id));
create policy "members add suppliers"
  on public.suppliers for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "members update suppliers"
  on public.suppliers for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "admins delete suppliers"
  on public.suppliers for delete to authenticated using (public.is_shop_admin(shop_id));

-- Sales history and stock movements are written by the RPCs; direct access is read-only for staff.
create policy "members read sales"
  on public.sales for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins manage sales"
  on public.sales for all to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

create policy "members read sale lines"
  on public.sale_lines for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins manage sale lines"
  on public.sale_lines for all to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

create policy "members read stock movements"
  on public.stock_movements for select to authenticated using (public.is_shop_member(shop_id));
create policy "admins manage stock movements"
  on public.stock_movements for all to authenticated using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

-- @@ backfill -----------------------------------------------------------------------------------

-- Accounts that already exist (for example after a reset that kept them) need a profile too, because
-- shops reference profiles. New sign-ups get theirs from the on_auth_user_created trigger.
insert into public.profiles (id, name, email)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'User'),
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
