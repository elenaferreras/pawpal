-- PawPal — server-side meal-reminder preferences + scheduler
-- Run once in the Supabase dashboard → SQL editor (after push.sql).
--
-- Why this exists: meal reminders used to be scheduled entirely client-side by
-- a setInterval loop, which the OS suspends the moment the app is backgrounded
-- or closed on mobile. This table mirrors each owner's meal-reminder config to
-- the server so a scheduled Edge Function (reminder-tick) can deliver a Web
-- Push at each meal time even while the app is closed.

create table if not exists public.reminder_prefs (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  -- The pawpal_data row whose meals we check to skip already-fed slots. This is
  -- `user_<uid>` for owners, or the primary owner's shared row for co-owners.
  owner_row_key text not null,
  meal_enabled  boolean not null default false,
  -- "HH:MM" per meal slot, index = slot.
  meal_times    text[] not null default '{}',
  meals_per_day int not null default 4,
  -- Daily walk nudge if no walk logged yet ("HH:MM" in the owner's zone).
  walk_enabled  boolean not null default false,
  walk_time     text not null default '09:00',
  -- Health nudges, all sent at 09:00 in the owner's zone.
  med_enabled   boolean not null default false,
  vacc_enabled  boolean not null default false,
  vet_enabled   boolean not null default false,
  -- IANA zone (e.g. "Europe/Zurich") so meal times fire in the owner's local
  -- time regardless of where the server runs.
  timezone      text not null default 'UTC',
  updated_at    timestamptz not null default now()
);

-- Idempotent upgrades for installs created before the walk/health columns.
alter table public.reminder_prefs add column if not exists walk_enabled boolean not null default false;
alter table public.reminder_prefs add column if not exists walk_time    text not null default '09:00';
alter table public.reminder_prefs add column if not exists med_enabled  boolean not null default false;
alter table public.reminder_prefs add column if not exists vacc_enabled boolean not null default false;
alter table public.reminder_prefs add column if not exists vet_enabled  boolean not null default false;

create index if not exists reminder_prefs_enabled_idx
  on public.reminder_prefs (meal_enabled);

alter table public.reminder_prefs enable row level security;

-- Clear any prior policies idempotently.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'reminder_prefs'
  loop
    execute format('drop policy if exists %I on public.reminder_prefs', pol.policyname);
  end loop;
end $$;

-- Owners manage only their own preference row. The service role (the
-- reminder-tick Edge Function) bypasses RLS to read every enabled row.
create policy "own prefs select"
  on public.reminder_prefs for select
  to authenticated using (user_id = auth.uid());

create policy "own prefs insert"
  on public.reminder_prefs for insert
  to authenticated with check (user_id = auth.uid());

create policy "own prefs update"
  on public.reminder_prefs for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own prefs delete"
  on public.reminder_prefs for delete
  to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Scheduler: invoke the reminder-tick Edge Function once a minute.
--
-- Prerequisites (enable once per project):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- Then set these two values, and (re)create the job below. Replace
-- <PROJECT_REF> with your project ref and <CRON_SECRET> with the same value you
-- set as the CRON_SECRET function secret (supabase secrets set CRON_SECRET=...).
-- The x-cron-secret header stops anyone from triggering the function publicly.
-- ─────────────────────────────────────────────────────────────

-- Remove a prior schedule if re-running this file.
select cron.unschedule('pawpal-reminder-tick')
where exists (select 1 from cron.job where jobname = 'pawpal-reminder-tick');

select cron.schedule(
  'pawpal-reminder-tick',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://fsmzrbysyeggcezxsura.functions.supabase.co/reminder-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
