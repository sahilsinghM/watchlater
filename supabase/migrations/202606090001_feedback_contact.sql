-- Add optional contact fields to feedback so the team can follow up with
-- users who opt in. Both columns are nullable — feedback can still be left
-- anonymously.
alter table public.feedback
  add column if not exists name text,
  add column if not exists email text;
