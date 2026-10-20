-- Live updates: a change made on one computer (a product added, stock sold, a price edited) reaches the other
-- computers that have the shop open, without a page refresh. Supabase Realtime streams the changes of the tables
-- in the `supabase_realtime` publication, to each signed-in user only for the rows their row-level-security
-- policies already let them read.
--
-- Safe to run more than once. A project without the publication (a plain Postgres) is left untouched.
begin;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['products', 'product_units', 'categories', 'customers', 'suppliers', 'sales', 'stock_movements'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    -- Lets a delete event carry the whole old row, not only its id.
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

commit;
