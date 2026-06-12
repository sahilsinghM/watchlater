# Changelog

All notable changes to WatchLater are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.0.1.0] - 2026-06-12

### Added

- **Supadata API adapter** (`src/lib/supadata-adapter.ts`): Zod schemas for every
  Supadata response shape; `parseSupadataResponse()` returns a typed discriminated
  union (`kind: "sync" | "async" | "error"`) so schema drift in the upstream API
  surfaces as a structured error instead of a silent TypeError mid-pipeline.
- **54 new tests** — Supadata contract tests pin the exact field names and types the
  live API must return; Supabase store contract tests cover field mapping (regression
  guard for the `lesson_video_id` / `lesson_id` FK bug), correct domain-type shapes,
  and fail-loud behaviour on DB errors for all write methods.
- `CLAUDE.md` now contains: Content Integrity rule (never fabricate transcript
  content), TDD mandate, Security checklist, and Known Issues (Supadata proxy
  requirement for datacenter IPs).

### Changed

- `transcript.server.ts` wired to the new Supadata adapter; all three `as`-casts
  replaced with `parseSupadataResponse()` and `SupadataJobResultSchema.safeParse()`.
- `supabaseStore.server.ts` refactored to a dependency-injection factory
  (`createSupabaseStore(getClient?)`) so tests can inject a Supabase spy without
  module-level mocking.

### Fixed

- `buildLesson` no longer fabricates placeholder cards ("Content from this video.")
  when given 0 cues — it throws immediately so the upstream quality gate (`assessTranscriptQuality`)
  can catch empty transcripts before they reach the lesson builder.
- `upsertAnonymousSession` replaced a SELECT-then-INSERT sequence (vulnerable to a
  unique-constraint collision under concurrent SSR requests) with a single atomic
  `.upsert({ onConflict: "session_key" })`.
- 5 Supabase write methods (`saveQuizResult`, `saveFeedback`, `createProcessingJob`,
  `updateProcessingJob`, `saveLead`) replaced bare `data!` null-assertions with
  explicit `if (error || !data) throw` — DB failures now surface immediately with
  a named error instead of a cryptic downstream TypeError.
- `fetchTranscript` and `pollSupadataJob` now wrap `await res.json()` in try/catch;
  HTML error pages returned by CDN layers no longer escape the ingest pipeline as
  uncaught `SyntaxError`.
- Supadata `jobId` is now `encodeURIComponent`-escaped before path interpolation,
  preventing a path-traversal via a crafted API response.
- Removed a dead `videoId` variable in `saveLesson` that computed a fake UUID-like
  string but was never used.
