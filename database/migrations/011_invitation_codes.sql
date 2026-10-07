-- KT POS System, migration 011: invitation codes.
--
-- People now join a shop with an invitation code instead of by email address. An owner (or admin) creates a code in
-- Settings > Team and passes it on; the person types it in when they sign up, or at their first sign-in. A code works
-- once and expires after a day. Someone with no code just signs up and sets up their own shop, as before.
--
-- Run it once in the Supabase SQL editor after 010 and **before** deploying the app that asks for invitation codes. It
-- is safe to run again. Fresh installs get all of this from schema.v2.sql.
--
-- What it changes:
--   * shop_invites no longer holds an email address. It holds the code, its role, an optional note about who it is
--     for, when it expires (one day) and when it was used.
--   * invite_member(), my_invites() and accept_invite() are replaced by create_invite() and redeem_invite().
--   * Invitations that were still waiting when you run this are deleted: they were tied to an email address and cannot
--     become codes. Create new ones. People who already joined a shop are not affected.

begin;

drop function if exists public.invite_member(uuid, text, public.shop_role);
drop function if exists public.my_invites();
drop function if exists public.accept_invite(uuid);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'shop_invites' and column_name = 'email') then
    delete from public.shop_invites;
    alter table public.shop_invites drop column email;
  end if;
end $$;

alter table public.shop_invites
  add column if not exists code text,
  add column if not exists label text,
  add column if not exists used_at timestamptz,
  add column if not exists used_by uuid references public.profiles(id) on delete set null;
alter table public.shop_invites alter column code set not null;
alter table public.shop_invites alter column expires_at set default now() + interval '1 day';
create unique index if not exists shop_invites_code_key on public.shop_invites(code);
create index if not exists shop_invites_shop_idx on public.shop_invites(shop_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_invites_label_check') then
    alter table public.shop_invites add constraint shop_invites_label_check check (label is null or char_length(label) <= 60);
  end if;
end $$;

create table if not exists public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invite_attempts_user_idx on public.invite_attempts(user_id, created_at);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

-- Team membership and invitation codes change only through the functions above (create_invite, redeem_invite,
-- revoke_invite, set_member_role, remove_member). Revoked explicitly rather than left to row-level security alone,
-- so a project whose tables get broad default privileges still cannot write them directly.
revoke insert, update, delete on public.shop_members, public.shop_invites from anon, authenticated;

-- Team management. A person joins a shop with an invitation code: an owner (or admin) creates one, passes it on,
-- and the person types it in when they sign up (or at first sign-in). Owners can create admin and cashier codes; admins
-- can create cashier codes. A code works once and expires after a day.

-- Codes use letters and digits that cannot be mistaken for each other (no 0 or O, no 1, I or L): ten of them, about
-- 8 x 10^14 possibilities. Not callable through the API; create_invite() uses it.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  random_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  -- skips the two bytes of a version-4 uuid that are not random
  picks constant integer[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12];
  result text := '';
  pick integer;
begin
  foreach pick in array picks loop
    result := result || substr(alphabet, 1 + (get_byte(random_bytes, pick) % 31), 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_invite(p_shop_id uuid, p_role public.shop_role, p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.shop_role := public.shop_role_of(p_shop_id);
  clean_label text := nullif(btrim(coalesce(p_label, '')), '');
  inv public.shop_invites;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if actor is null or actor = 'cashier' then raise exception 'Only admins can create invitation codes'; end if;
  if p_role = 'owner' then raise exception 'A shop has exactly one owner'; end if;
  if p_role = 'admin' and actor <> 'owner' then raise exception 'Only the owner can invite admins'; end if;
  if clean_label is not null and char_length(clean_label) > 60 then
    raise exception 'The name or note can be at most 60 characters';
  end if;

  -- Old codes that were used or expired a month ago are no use to anyone.
  delete from public.shop_invites
  where shop_id = p_shop_id and coalesce(used_at, expires_at) < now() - interval '30 days';
  if (select count(*) from public.shop_invites where shop_id = p_shop_id and used_at is null and expires_at > now()) >= 25 then
    raise exception 'There are already 25 unused invitation codes. Cancel some, or wait for them to expire.';
  end if;

  loop
    begin
      insert into public.shop_invites (shop_id, code, role, label, invited_by)
      values (p_shop_id, public.generate_invite_code(), p_role, clean_label, auth.uid())
      returning * into inv;
      exit;
    exception when unique_violation then
      null; -- the code was already taken (a one-in-a-trillion clash): make another
    end;
  end loop;

  return jsonb_build_object('id', inv.id, 'code', inv.code, 'role', inv.role, 'label', inv.label, 'expires_at', inv.expires_at);
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

-- Joins the caller to the shop the code belongs to, with the role it was created for, and uses the code up.
-- Returns {"shop_id", "role"} when it worked, or {"error": "invalid_code"} / {"error": "too_many_attempts"}. Those two are
-- returned rather than raised so that a wrong guess is still recorded: raising would roll the record back. A wrong
-- code, an expired one and a used one all look the same, and ten wrong tries in an hour lock the caller out for that hour.
create or replace function public.redeem_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inv public.shop_invites;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.shop_members where user_id = auth.uid()) then
    raise exception 'You already belong to a shop';
  end if;

  delete from public.invite_attempts where created_at < now() - interval '1 day';
  if (select count(*) from public.invite_attempts where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  -- Locking the row makes two people typing the same code at once safe: the second finds it already used.
  select * into inv from public.shop_invites
  where code = clean and used_at is null and expires_at > now()
  for update;
  if not found then
    insert into public.invite_attempts (user_id) values (auth.uid());
    return jsonb_build_object('error', 'invalid_code');
  end if;

  insert into public.shop_members (shop_id, user_id, role) values (inv.shop_id, auth.uid(), inv.role);
  update public.shop_invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  return jsonb_build_object('shop_id', inv.shop_id, 'role', inv.role);
end;
$$;

revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.create_invite(uuid, public.shop_role, text) from public, anon;
grant execute on function public.create_invite(uuid, public.shop_role, text) to authenticated;
revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

commit;
