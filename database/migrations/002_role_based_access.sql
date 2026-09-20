-- Closes two auth/authorization gaps found in the live schema:
--   1. handle_new_user() hardcoded every self-signup to role = 'admin'.
--   2. products/categories had "for all ... using (true)" policies, so any
--      authenticated account (i.e. any self-signup) could edit the catalog
--      and prices.
-- Apply this against an existing project that was created from schema.v2.sql
-- before this fix. Safe to run multiple times.

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

drop policy if exists "authenticated users can manage POS data" on public.categories;
drop policy if exists "authenticated users can read categories" on public.categories;
drop policy if exists "admins can manage categories" on public.categories;
drop policy if exists "admins can update categories" on public.categories;
drop policy if exists "admins can delete categories" on public.categories;

create policy "authenticated users can read categories"
  on public.categories for select to authenticated using (true);
create policy "admins can manage categories"
  on public.categories for insert to authenticated with check (public.is_admin());
create policy "admins can update categories"
  on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete categories"
  on public.categories for delete to authenticated using (public.is_admin());

drop policy if exists "authenticated users can manage POS data" on public.products;
drop policy if exists "authenticated users can read products" on public.products;
drop policy if exists "admins can add products" on public.products;
drop policy if exists "admins can update products" on public.products;
drop policy if exists "admins can delete products" on public.products;

create policy "authenticated users can read products"
  on public.products for select to authenticated using (true);
create policy "admins can add products"
  on public.products for insert to authenticated with check (public.is_admin());
create policy "admins can update products"
  on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete products"
  on public.products for delete to authenticated using (public.is_admin());

-- One-time bootstrap: every existing profile was created as 'admin' under the
-- old trigger. Uncomment and set the right id(s) to keep specific accounts as
-- admin, then run this block once to demote everyone else to 'cashier'.
-- update public.profiles set role = 'cashier' where id not in ('<keep-as-admin-uuid>');
