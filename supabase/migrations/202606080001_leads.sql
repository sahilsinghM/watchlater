-- Early-access waitlist leads. One contactable row per person (unique email),
-- captured from the lesson hero or the completion screen. Stored via the
-- service-role admin client only (no client-side RLS path), like feedback.

create extension if not exists citext;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  email citext not null unique,
  source text not null,
  lesson_video_id text,
  created_at timestamptz not null default now()
);

create index if not exists leads_session_idx on public.leads(session_id);
