-- PawPal — Dog-sitter (guest) sharing: schema & row-level security
-- Run once in the Supabase dashboard → SQL editor (after rls.sql).
--
-- Model: an owner issues a short-lived, revocable INVITE (a human code) scoped
-- to their dog with "can log" permissions. A sitter CLAIMS the code and gets an
-- ephemeral SESSION token. All privileged reads/writes go through Edge
-- Functions using the service-role key — clients never touch another account's
-- pawpal_data row directly.

-- ── Invites ───────────────────────────────────────────────────────────────
create table if not exists public.sitter_invites (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- The pawpal_data row this invite shares, e.g. 'user_<uid>'.
  owner_row_key text not null,
  dog_name      text,
  -- Human, single-claim access code (shown to the sitter). Low-sensitivity:
  -- short-lived, single-use and revocable. Stored so the owner can re-display
  -- it while the invite is still pending.
  code          text not null unique,
  permissions   jsonb not null default '{"log": true}'::jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  claimed_at    timestamptz,
  -- A human label for who claimed it (sitter email or "Guest device").
  claimed_by    text,
  revoked_at    timestamptz
);

create index if not exists sitter_invites_owner_idx
  on public.sitter_invites (owner_user_id);
create index if not exists sitter_invites_code_idx
  on public.sitter_invites (code);

-- ── Sessions ──────────────────────────────────────────────────────────────
create table if not exists public.sitter_sessions (
  token         text primary key,
  invite_id     uuid not null references public.sitter_invites (id) on delete cascade,
  owner_row_key text not null,
  permissions   jsonb not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists sitter_sessions_invite_idx
  on public.sitter_sessions (invite_id);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.sitter_invites  enable row level security;
alter table public.sitter_sessions enable row level security;

-- Clear any prior policies idempotently.
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('sitter_invites', 'sitter_sessions')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Owners may READ their own invites (to list active/past sitters). Creating and
-- revoking go through Edge Functions (service role), so no client insert/update
-- /delete policy is granted here.
create policy "owner reads own invites"
  on public.sitter_invites
  for select
  to authenticated
  using (owner_user_id = auth.uid());

-- sitter_sessions has RLS enabled with NO policies → all client (anon /
-- authenticated) access is denied. Only the service role (Edge Functions) can
-- read or write it.
