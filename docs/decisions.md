# Product And Implementation Decisions

This document locks the decisions that should not be re-litigated during MVP implementation unless a new explicit product decision replaces them.

## Product Scope

- The MVP scope is the PRD MVP, not a one-video demo.
- The core user journey is: paste URL, process video, review generated lesson hero, inspect timeline, move through lesson cards, complete quiz, reach completion, ask tutor questions, and leave usefulness feedback.
- MVP success is achieved when a user completes a generated lesson for a supported video and rates the lesson useful.
- Synthetic fallback lessons are not part of the MVP. Prototype fallback behavior must be removed or hidden behind a non-production development flag.

## Supported Video Policy

- Supported source: public YouTube videos only.
- Language: English only.
- Duration: 5 to 90 minutes inclusive.
- Transcript: required. A video without an available transcript must fail clearly.
- Shorts: not supported.
- Private, age-restricted, region-blocked, embedding-blocked, deleted, or unavailable videos are not supported.
- Live streams and videos without stable duration/transcript data are not in MVP scope.

## Backend And Persistence

- Backend: Supabase.
- The MVP must persist videos, transcript chunks, generated lessons, screenshots, anonymous sessions, quiz results, tutor interactions as needed, and feedback.
- The current in-memory `lessonCache` in `src/lib/ingest.functions.ts` is prototype-only and must be replaced with Supabase persistence.
- Anonymous sessions are required for MVP. User accounts and login are explicitly out of scope.
- Session identity should be stable enough to connect lesson completion, quiz results, feedback, and a user's current processing job without requiring authentication.

## AI And Generation

- AI provider: OpenAI only.
- Generated lesson output must validate against a strict schema based on `src/lib/lessonSchema.ts`.
- The generated lesson must be grounded in fetched metadata, transcript chunks, and available screenshot/key-frame context.
- No synthetic or placeholder lesson should be served to a user when generation fails.
- OpenAI failures must surface as a generation failure state with retry or try-another-video behavior.

## Screenshots

- Screenshot policy: minimal 3 to 5 key frames per processed video.
- Screenshots should support lesson grounding and key moments, not become a full visual transcript.
- Screenshot failure should not silently produce fake visual context. It must be represented as a processing failure or a degraded state only if explicitly designed and stored.

## Design Direction

- Design must preserve the current Pixel Perfect View style exactly.
- The design system name is **Tactile Field Guide**.
- Current design source files are `src/styles.css`, `src/routes/index.tsx`, `src/routes/lesson.$videoId.tsx`, and the core components under `src/components/`.
- Keep the cream background, heavy black borders, hard offset shadows, playful mascot, bold display typography, compact cards, rounded inputs, and blue/yellow/green accents.
- Do not introduce generic SaaS dashboard styling, minimal gray styling, purple gradients, decorative orbs, unrelated illustration systems, or a mascot-free brand direction.

## Current Scaffold Versus MVP Target

Current scaffold:

- `src/routes/index.tsx` accepts a YouTube URL or the `sample` shortcut.
- `src/routes/processing.$videoId.tsx` animates fixed local steps while a React Query request resolves.
- `src/lib/ingest.functions.ts` fetches some YouTube metadata/transcript data, caches in memory, and falls back to synthetic cues when transcript fetching fails.
- `src/lib/buildLesson.ts` builds a templated lesson from transcript cues.
- `src/components/TutorPanel.tsx` answers from seeded local QA and fallback lesson text.

MVP target:

- `sample` remains development-only or is removed from the public MVP flow.
- Processing steps reflect real persisted job status.
- Ingestion validates supported-video policy before generation.
- Supabase stores every meaningful processing artifact and user outcome.
- OpenAI generates the lesson against the required schema.
- Tutor answers are grounded in the generated lesson and transcript context.
- Feedback is captured and connected to anonymous session and lesson records.
