-- KT POS System: RESET
--
-- !!  THIS ERASES EVERY SHOP AND ALL OF ITS DATA (products, sales, customers, stock, team, invites).  !!
-- !!  IT CANNOT BE UNDONE. Take a backup first (Supabase > Database > Backups).                       !!
--
-- It removes only the objects that belong to this app in the `public` schema, plus the sign-up
-- trigger on auth.users. Your Supabase project, its extensions and other schemas are left alone.
-- By default it KEEPS user accounts (people can sign in again and will be asked to set up a shop).
-- To delete the accounts too, uncomment the last statement below.
--
-- After it finishes, run database/schema.v2.sql to install the current schema.
--
-- Safety catch: the script refuses to run until you change `false` to `true` on the line below.

do $$
begin
  if not (false) then   -- <-- change false to true to arm this script
    raise exception 'Reset is not armed. Edit "false" to "true" near the top of this script only if you really want to erase everything.';
  end if;
end;
$$;

begin;

-- 1. The sign-up trigger.
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Tables (their policies, triggers, indexes and foreign keys go with them).
drop table if exists
  public.sale_lines,
  public.stock_movements,
  public.sales,
  public.customers,
  public.suppliers,
  public.products,
  public.categories,
  public.shop_invites,
  public.shop_members,
  public.shops,
  public.profiles
cascade;

-- 3. Functions, whatever their signatures (this covers every earlier version of the schema too).
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'handle_new_user', 'is_admin', 'protect_profile_role',
        'shop_role_of', 'is_shop_member', 'is_shop_admin', 'shares_shop_with',
        'guard_shop_update', 'prevent_shop_change',
        'create_shop', 'invite_member', 'revoke_invite', 'my_invites', 'accept_invite',
        'set_member_role', 'remove_member', 'create_sale', 'record_stock_movement'
      )
  loop
    execute format('drop function if exists %s cascade', fn.signature);
  end loop;
end;
$$;

-- 4. Types.
drop type if exists public.shop_role, public.user_role, public.payment_method, public.stock_movement_type cascade;

-- OPTIONAL: also delete every account, so everyone has to sign up again. Uncomment to use.
-- delete from auth.users;

commit;
