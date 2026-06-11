# TODOS

Deferred scope from /autoplan review (2026-06-05, commit fed6eeb).

## Phase A pre-requisites (fix before stranger testing)

- [x] **[C1] Synthetic cue fallback must fail closed** — `ingest.functions.ts:289` — throw `NO_CAPTIONS` instead of fabricating a lesson; removes trust hazard **Completed: 2026-06-05**
- [x] **[C2] Supabase lesson_id FK** — verify `quiz/feedback` routes pass UUID not YouTube ID; `supabaseStore.server.ts:156` — likely silently failing in production **Completed: 2026-06-05**
- [x] **[C3] WatchScore disclosure** — `buildLesson.ts:103` — add disclaimer or gate display on AI generation having run **Completed: 2026-06-05**
- [x] **[H1] NON_ENGLISH language bypass** — `ingest.functions.ts:308` — pass actual `languageCode` from InnerTube caption track to `assessTranscriptQuality` **Completed: 2026-06-05**
- [x] **[H2] Job status for TOO_SHORT/TOO_LONG** — `ingest.functions.ts:299` — move job failure update to outer catch **Completed: 2026-06-05**
- [x] **[H3] Fake processing step 4** — `processing.$videoId.tsx:16` — replace "Capturing important visuals" with "Analyzing key moments" **Completed: 2026-06-05**

## Phase A polish (after first 5 stranger sessions)

- [ ] **Server-driven progress bar** — replace 650ms timer with real job status polling
- [ ] **Optional email capture** — end of first lesson; seeds identity for taste model
- [ ] **Concurrent dedup** — getLessonByYoutubeId in-flight lock to prevent duplicate LLM calls and Supabase races

## Phase B (backlog triage layer — see design doc)

- [ ] **Multi-URL intake UI** — paste 10-30 URLs, process sequentially
- [ ] **Per-video scoring** — novelty/depth/actionability (1-5 each), thesis, "Worth watching if..."
- [ ] **backlog_items table** — new Supabase table; see schema in design doc
- [ ] **Ranked backlog view** — WatchScore aggregation + "Pick my top 3"
- [ ] **Watch/Skim/Archive/Not-relevant decisions** — captured to Supabase for taste model seeding
- [ ] **Phase B.2: account creation** — optional email to persist decision history across browsers

## Test debt

- [ ] Add tests for synthetic cue path (expect NO_CAPTIONS, not a lesson)
- [ ] Add tests for `buildLesson` with 0, 4, 12 cues
- [ ] Add integration test for Supabase quiz/feedback saves
- [x] Add `assessTranscriptQuality` test with non-English language code **Completed: 2026-06-05**

## Design audit deferrals (2026-06-11, /design-review)
- [ ] MED: Tone toggle floats unlabeled on the lesson page mobile layout — anchor it or label it
- [ ] LOW: Attention-map bar sliver segments are sub-44px touch targets on phones
- [ ] LOW: FAB grazes the 3rd reaction button corner on the player at 430px — pad the reaction row
- [ ] LOW: favicon 404 on every page
- [ ] LOW: lesson hero title wraps 4 lines at 390px before any visual
