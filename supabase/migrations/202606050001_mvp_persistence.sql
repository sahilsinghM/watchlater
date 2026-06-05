create table if not exists public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  url text not null,
  title text,
  channel text,
  duration_seconds integer,
  language text,
  thumbnail_url text,
  support_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  youtube_id text not null,
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  status text not null,
  current_step text not null,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processing_jobs_youtube_id_idx on public.processing_jobs(youtube_id);
create index if not exists processing_jobs_session_id_idx on public.processing_jobs(session_id);

create table if not exists public.transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  start_seconds numeric not null,
  duration_seconds numeric,
  text text not null,
  language text,
  source_kind text,
  created_at timestamptz not null default now()
);

create index if not exists transcript_chunks_video_start_idx
  on public.transcript_chunks(video_id, start_seconds);

create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  timestamp_seconds numeric not null,
  storage_path text not null,
  caption text,
  capture_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists screenshots_video_timestamp_idx
  on public.screenshots(video_id, timestamp_seconds);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  youtube_id text not null,
  schema_version text not null default 'lesson.v1',
  openai_model text,
  generation_metadata jsonb not null default '{}'::jsonb,
  lesson_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (youtube_id, schema_version)
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_video_id text not null,
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  answers jsonb not null,
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now()
);

create index if not exists quiz_results_session_idx on public.quiz_results(session_id);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_video_id text not null,
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  useful boolean not null,
  reason text,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_session_idx on public.feedback(session_id);

create table if not exists public.tutor_interactions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_video_id text not null,
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  question text not null,
  answer text not null,
  supported boolean not null,
  created_at timestamptz not null default now()
);
