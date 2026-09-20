-- Lets the Data API reach the public tables. Row-level security still decides which rows a
-- signed-in user can see. Newer Supabase projects do not grant this by default, which surfaces as
-- "permission denied for table shop_members" (42501) after login.
--
-- Safe to run more than once. Fresh installs get the same GRANTs from schema.v2.sql.

grant usage on schema public to anon, authenticated;

grant select on
  public.profiles,
  public.shops,
  public.shop_members,
  public.shop_invites,
  public.categories,
  public.products,
  public.customers,
  public.suppliers,
  public.sales,
  public.sale_lines,
  public.stock_movements
to authenticated;

grant insert, update, delete on
  public.categories,
  public.products,
  public.customers,
  public.suppliers,
  public.sales,
  public.sale_lines,
  public.stock_movements
to authenticated;

grant update on public.shops to authenticated;

revoke update on public.profiles from authenticated, anon;
grant update (name) on public.profiles to authenticated;
