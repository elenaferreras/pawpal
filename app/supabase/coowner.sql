-- PawPal — Co-owner (shared full access) sharing: schema & row-level security
-- Run once in the Supabase dashboard → SQL editor (after rls.sql).
--
-- Model: unlike a sitter (ephemeral, log-only, brokered through Edge Functions),
-- a CO-OWNER is a second account with persistent, full, two-way access to the
-- SAME pawpal_data row as the primary owner. The primary owner issues a
-- single-use, non-expiring, revocable INVITE. The invitee (who must have their
-- own account) JOINS, which records a MEMBERSHIP row. Row-level security then
-- grants every member direct read/write on the shared row — so co-owners keep
-- the normal offline-first, whole-blob sync, just pointed at the shared row.

-- ── Membership ──────────────────────────────────────────────────────────────
-- Maps auth users to the shared pawpal_data row they co-own (e.g. 'user_<uid>').
create table if not exists public.dog_members (
  -- The shared pawpal_data.id this membership grants access to.
  row_key    text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'coowner',
  added_at   timestamptz not null default now(),
  primary key (row_key, user_id)
);

create index if not exists dog_members_user_idx
  on public.dog_members (user_id);
create index if not exists dog_members_row_idx
  on public.dog_members (row_key);

-- ── Invites ─────────────────────────────────────────────────────────────────
-- Single-use, non-expiring, revocable. No expires_at by design.
create table if not exists public.coowner_invites (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references auth.users (id) on delete cascade,
  -- The pawpal_data row this invite shares, e.g. 'user_<owner_uid>'.
  owner_row_key   text not null,
  dog_name        text,
  -- Owner-chosen display name for this co-owner (optional; overrides the email).
  label           text,
  -- Human, single-claim access code (shown to the invitee).
  code            text not null unique,
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz,
  -- Human label for who claimed it (email), plus their auth uid for revocation.
  claimed_by      text,
  claimed_user_id uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz
);

-- Backfill for databases created before the label column existed.
alter table public.coowner_invites
  add column if not exists label text;

create index if not exists coowner_invites_owner_idx
  on public.coowner_invites (owner_user_id);
create index if not exists coowner_invites_code_idx
  on public.coowner_invites (code);

-- ── pawpal_data RLS: grant members direct access to the shared row ──────────
-- Replaces the "own account rows" policy from rls.sql with one that also admits
-- co-owners via a dog_members lookup. The anonymous device policy is untouched.
drop policy if exists "own account rows" on public.pawpal_data;
drop policy if exists "account or member rows" on public.pawpal_data;

create policy "account or member rows"
  on public.pawpal_data
  for all
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.dog_members m
      where m.row_key = pawpal_data.id and m.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.dog_members m
      where m.row_key = pawpal_data.id and m.user_id = auth.uid()
    )
  );

-- SECURITY: the membership branch of the policy would otherwise let a co-owner
-- rewrite user_id/id and hijack or transfer the row. Lock both columns for
-- anyone who isn't the primary owner. Service-role calls (Edge Functions) have
-- a null auth.uid() and are exempt.
create or replace function public.pawpal_data_lock_owner()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> old.user_id then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
      raise exception 'co-owners may not change row ownership';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pawpal_data_lock_owner_trg on public.pawpal_data;
create trigger pawpal_data_lock_owner_trg
  before update on public.pawpal_data
  for each row execute function public.pawpal_data_lock_owner();

-- ── Row-level security on the new tables ────────────────────────────────────
alter table public.dog_members     enable row level security;
alter table public.coowner_invites enable row level security;

-- Clear any prior policies idempotently.
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('dog_members', 'coowner_invites')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Members may read their own membership; a primary owner may read every member
-- of their row (to list co-owners). All writes go through Edge Functions
-- (service role), so no client insert/update/delete policy is granted.
create policy "read own or owned memberships"
  on public.dog_members
  for select
  to authenticated
  using (user_id = auth.uid() or row_key = 'user_' || auth.uid()::text);

-- Owners may read their own invites (to list/re-display pending codes). Creating
-- and revoking go through Edge Functions (service role).
create policy "owner reads own coowner invites"
  on public.coowner_invites
  for select
  to authenticated
  using (owner_user_id = auth.uid());
