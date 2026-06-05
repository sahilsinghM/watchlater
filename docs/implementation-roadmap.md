# Implementation Roadmap

This roadmap moves the current visually complete scaffold to the full MVP while preserving the Tactile Field Guide design.

## Phase 1: Documentation Foundation

Status: complete when this `docs/` folder exists and matches the current app.

Deliverables:

- Add documentation index, decisions, MVP spec, design document, design system reference, and implementation roadmap.
- Reference current source files as design source of truth:
  - `src/styles.css`
  - `src/routes/index.tsx`
  - `src/routes/processing.$videoId.tsx`
  - `src/routes/lesson.$videoId.tsx`
  - `src/routes/lesson.$videoId.player.tsx`
  - `src/routes/lesson.$videoId.quiz.tsx`
  - `src/routes/lesson.$videoId.done.tsx`
  - `src/components/Brand.tsx`
  - `src/components/WatchScoreDial.tsx`
  - `src/components/AttentionTimeline.tsx`
  - `src/components/LessonCard.tsx`
  - `src/components/TutorPanel.tsx`
  - `src/components/YouTubeEmbed.tsx`
- Document current scaffold state separately from target MVP state.
- Lock the current Pixel Perfect View visual direction as Tactile Field Guide.

Acceptance:

- Every major product decision is represented in `docs/decisions.md`.
- `docs/design-system-reference.md` matches the current tokens in `src/styles.css`.
- No doc instructs implementers to move away from the current visual language.
- App behavior is unchanged by this phase.

## Phase 2: MVP Backend

Goal: replace prototype memory and implicit state with Supabase persistence.

Deliverables:

- Add Supabase project configuration and environment documentation.
- Add schema migrations for:
  - `videos`: YouTube ID, URL, title, channel, duration, language, thumbnail, source metadata, support status.
  - `transcript_chunks`: video ID, start, end/duration, text, language, source kind.
  - `processing_jobs`: video ID, anonymous session ID, status, current step, error code, error detail, timestamps.
  - `lessons`: video ID, generated lesson JSON, schema version, OpenAI model, generation metadata.
  - `lesson_segments`: optional normalized segment rows if querying separately from lesson JSON is useful.
  - `screenshots`: video ID, timestamp, storage path, caption/context, capture status.
  - `anonymous_sessions`: generated session key, first seen, last seen.
  - `quiz_results`: lesson ID, session ID, answers, score, total, completed timestamp.
  - `feedback`: lesson ID, session ID, rating/useful flag, optional reason, source screen, timestamp.
- Replace `lessonCache` in `src/lib/ingest.functions.ts` with Supabase-backed lookup and persistence.
- Keep current route structure and current visual design.

Acceptance:

- Refreshing processing or lesson pages reads persisted state.
- Duplicate processing for the same supported video reuses persisted artifacts when valid.
- Anonymous session connects job, quiz result, and feedback without login.
- Supabase errors produce explicit failure state rather than synthetic lesson content.

## Phase 3: Real Processing

Goal: make lesson creation real, validated, and grounded.

Deliverables:

- Implement supported-video validation:
  - Valid YouTube watch/share URL.
  - Not Shorts.
  - Public and playable.
  - English.
  - 5 to 90 minutes.
  - Transcript available.
- Implement robust metadata and transcript fetch.
- Store transcript chunks in Supabase.
- Implement screenshot extraction and storage for 3 to 5 key frames.
- Implement OpenAI lesson generation:
  - Provider is OpenAI only.
  - Prompt uses metadata, transcript chunks, and screenshot/key-frame context.
  - Output validates against `src/lib/lessonSchema.ts` or a deliberate versioned extension of it.
  - Invalid output retries only within bounded policy.
- Remove production synthetic fallback from `src/lib/buildLesson.ts` and `src/lib/ingest.functions.ts`.
- Keep prototype/sample generation available only under an explicit development path if still useful.

Acceptance:

- A supported video produces a transcript-backed lesson.
- An unsupported video maps to the correct failure state.
- No production user receives a placeholder, synthetic, or fake lesson after generation failure.
- The generated timeline, cards, quiz, tutor seeds/context, best part, skip part, and recommendation are grounded in source data.

## Phase 4: MVP UX Completion

Goal: wire the complete user journey through current UI surfaces.

Deliverables:

- Wire persisted processing job status into the current processing screen.
- Render generated lesson data through existing components.
- Add all required failure states using current error visual style:
  - Invalid URL.
  - Shorts.
  - Private or blocked.
  - No transcript.
  - Too long.
  - Too short.
  - Non-English.
  - Generation failure.
  - Screenshot failure.
  - Persistence failure.
- Persist quiz answers and final score.
- Add feedback capture after completion or from the lesson hero/completion flow.
- Replace seeded tutor behavior with grounded tutor responses.
- Preserve Tactile Field Guide styling on every new state.

Acceptance:

- User can complete the full MVP journey end to end.
- Completion and usefulness feedback are stored.
- Tutor refuses unsupported answers rather than inventing content.
- Visual QA confirms the app still matches current Pixel Perfect View style.

## Phase 5: Verification And Hardening

Goal: make the MVP reliable enough to ship.

Deliverables:

- Unit tests for URL parsing, support validation, schema validation, failure mapping, and Supabase persistence helpers.
- Integration tests for processing job lifecycle and generated lesson retrieval.
- Route-level tests for paste, processing success, processing failure, lesson hero, player, quiz, completion, and feedback.
- Snapshot or screenshot QA for major screens to catch design drift.
- Observability for ingestion, screenshot capture, OpenAI generation, validation failures, and feedback submission.

Acceptance:

- Build passes.
- Tests cover happy path and required failure states.
- Design review confirms no drift from Tactile Field Guide.
- A new engineer can follow these docs and implement remaining MVP work without making new foundational product or design choices.

## Implementation Notes

- Keep route names and component boundaries unless a concrete implementation constraint requires changing them.
- Prefer extending `src/lib/lessonSchema.ts` with versioned schema changes over ad hoc response shapes.
- Keep lesson rendering tolerant of missing optional fields, but do not tolerate missing required generated fields.
- Any new UI must reuse current tokens, borders, shadows, radii, fonts, and motion.
- Treat design drift as a product regression, not a polish issue.
