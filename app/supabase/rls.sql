-- PawPal — Supabase schema & row-level security
-- Run this once in the Supabase dashboard → SQL editor.
--
-- Model: one row per identity in `pawpal_data`.
--   • Signed-in accounts  → id = 'user_<uid>', user_id = auth.uid()
--   • Anonymous devices   → id = '<device_id>', user_id = NULL
--
-- RLS goals:
--   • An authenticated user can only read/write their own row.
--   • Anonymous (anon key) requests keep working for device rows only,
--     and can never touch an account's data.

-- 1. Owner column linking a row to a Supabase Auth user (nullable = device row).
alter table public.pawpal_data
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2. Turn on row-level security (denies everything until a policy allows it).
alter table public.pawpal_data enable row level security;

-- 3. Remove ANY existing policies first. The original project may carry a
--    permissive "allow all" policy (needed when the app read device rows with
--    just the anon key); left in place it would OR with ours and leak account
--    rows to anonymous requests. This loop clears the slate idempotently.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'pawpal_data'
  loop
    execute format('drop policy if exists %I on public.pawpal_data', pol.policyname);
  end loop;
end $$;

-- 4. Authenticated users: full access to their own row only.
create policy "own account rows"
  on public.pawpal_data
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Anonymous device rows: only rows with no owner. This preserves the
--    existing device-scoped sync and blocks the anon key from reading any
--    account-owned row.
create policy "anonymous device rows"
  on public.pawpal_data
  for all
  to anon
  using (user_id is null)
  with check (user_id is null);
