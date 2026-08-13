-- PawPal — Web Push subscriptions: schema & row-level security
-- Run once in the Supabase dashboard → SQL editor (after rls.sql).
--
-- Model: each of the owner's devices/browsers registers a push subscription
-- (endpoint + encryption keys) scoped to their account. The owner's app writes
-- and removes its own rows directly (RLS below); the sitter-log Edge Function
-- reads them with the service role to deliver a push when a sitter logs
-- activity — so the owner is notified even when the app is closed.

create table if not exists public.push_subscriptions (
  -- The push service endpoint URL uniquely identifies a subscription.
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Client public key + auth secret used to encrypt the push payload.
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Clear any prior policies idempotently.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
  loop
    execute format('drop policy if exists %I on public.push_subscriptions', pol.policyname);
  end loop;
end $$;

-- Owners manage only their own subscriptions. The service role (Edge Function)
-- bypasses RLS to read them when sending a push.
create policy "own subs select"
  on public.push_subscriptions for select
  to authenticated using (user_id = auth.uid());

create policy "own subs insert"
  on public.push_subscriptions for insert
  to authenticated with check (user_id = auth.uid());

create policy "own subs update"
  on public.push_subscriptions for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own subs delete"
  on public.push_subscriptions for delete
  to authenticated using (user_id = auth.uid());
