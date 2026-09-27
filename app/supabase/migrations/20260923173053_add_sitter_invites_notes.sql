-- Add the owner notes column used by sitter invites. It was declared in
-- sitter.sql but never applied to the live project, so every invite create
-- (which always sends `notes`) failed with PGRST204.
alter table public.sitter_invites add column if not exists notes text;

-- Refresh PostgREST's schema cache so the new column is visible immediately.
notify pgrst, 'reload schema';
