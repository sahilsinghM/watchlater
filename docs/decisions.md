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

## Ingest Architecture

**Historical context — why this was hard.** Vercel (and every other datacenter host) runs on IPs that YouTube blocks at the InnerTube/caption level, causing `LOGIN_REQUIRED` / empty caption tracks even for public videos. YouTube also added **PoToken** ("proof of origin") bot-detection in 2025–2026. A hand-rolled InnerTube + watch-page + caption-XML pipeline works from a residential IP and fails from every datacenter IP. Headless Chrome, `chrome-aws-lambda`, `youtubei.js` PoToken, cookies, and provider-switching were all tried and were fragile or failed to deploy. **The real cause was IP reputation, not the fetch code** — the only things that reliably work are a residential proxy or a managed transcript API.

**Chosen fix: a managed transcript API (Supadata).** Transcript fetching is delegated to **Supadata** (`https://api.supadata.ai/v1/transcript`), which absorbs the IP/PoToken problem server-side. Because Supadata removed the IP requirement, the transcript + LLM work moved back into Vercel, eliminating the Railway/VPS worker as a required service.

Locked decisions:

- **Canonical production path: inline processing inside the Vercel Function, AWAITED.** `requestLesson` (`src/lib/ingest.functions.ts`) creates a Supabase job row, then `await`s `processLesson()` (`src/lib/processLesson.server.ts`). The request stays open while the page polls status. **Do NOT switch this to fire-and-forget `waitUntil`** — it does not survive in the TanStack Start / Nitro serverFn environment on Vercel (the function freezes after returning and the background promise is dropped), which left jobs stuck at "fetching video details" forever. Awaiting is what keeps the instance alive to finish the work.
- **The whole pipeline must finish within the Vercel function's `maxDuration`, which is 300s** (the platform default on all plans — empirically confirmed 2026-06-11: a generation ran 3m47s before our own code aborted it; the earlier "hard 60s Hobby cap" claim in this doc was wrong). Generation uses **Sonnet 4.6, `thinking` DISABLED, `effort: "low"`, `max_tokens` ~12k** — thinking must stay off because it shares the `max_tokens` budget with the output and on long transcripts repeatedly consumed all of it, returning zero text blocks ("Anthropic returned an empty response"). Measured headroom: an 8h44m video builds in ~97s; a 12h video extrapolates to ~2min. The job row gets a 45s heartbeat during generation so multi-minute builds aren't misread as stale.
- **There is no silent no-op.** A request must never create a job it has no intention of processing. If neither path can run, the job fails loud with a clear `IngestErrorCode`.
- **Transcript via Supadata `mode=native`** (existing captions only — no Whisper generation, a locked policy), authenticated via `SUPADATA_API_KEY`; `src/lib/transcript.server.ts` fails closed if the key is missing. **Metadata stays on oEmbed** (a public, non-IP-blocked endpoint).
- **Processing is async and job-tracked.** The processing page polls `getIngestStatus()` every 2 seconds until `ready` or `failed`. Failure `errorCode`s use the `IngestErrorCode` vocabulary so the page's `ERROR_COPY` renders the right message.
- **There is no external worker.** The standalone Bun worker (`ingest-worker/`), its VPS deploy assets, and the `INGEST_WORKER_URL`/`INGEST_WORKER_SECRET` dispatch path were **removed on 2026-06-11** (owner decision, after inline proved out to the 12-hour cap). Inline is the only pipeline. Do not re-add a second ingest path unless the 300s function budget genuinely becomes the bottleneck — two pipelines means two places for code and secrets to drift, which is exactly why this one was killed. The deleted code is recoverable from git history (last present at tag/commit `b532007`).
- **Do not add `chrome-aws-lambda`, `puppeteer-core`, or headless Chromium** back to the bundle, and **do not re-introduce the hand-rolled InnerTube/watch-page parser or a residential proxy** unless Supadata is dropped. A managed API makes browser emulation unnecessary, and a second transcript code path is the exact fragility this removed.

The Supabase Edge Function (`supabase/functions/fetch-yt-captions/`) was a non-functional skeleton and has been **deleted from the repo** (2026-06-11); if it is still deployed on Supabase, undeploy it. Do not wire `requestLesson` to anything but the inline path.

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
