-- Atomic jsonb merge for secondary lesson fields (quiz, keyMoments, visualContextStatus).
-- Called by patchLesson in supabaseStore.server.ts after generateSecondary resolves.
-- Using jsonb || avoids a fetch-then-write race and keeps the update to a single round-trip.
create or replace function patch_lesson_secondary(
  p_youtube_id text,
  p_patch jsonb
)
returns void
language sql
security definer
as $$
  update lessons
  set
    lesson_json = lesson_json || p_patch,
    updated_at  = now()
  where youtube_id    = p_youtube_id
    and schema_version = 'lesson.v1';
$$;
