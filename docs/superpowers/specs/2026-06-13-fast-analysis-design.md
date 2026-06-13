# Fast Analysis — Design Spec
*2026-06-13*

## Goal

Reduce end-to-end lesson generation from ~90-120s to ~25-40s for a typical
2-hour video by parallelising network calls and splitting the single Claude
generation call into two concurrent smaller calls, then revealing content to
the user progressively as each resolves.

Target: under 30s for most videos. Realistic floor for 2-hour videos with
Supadata async polling: ~25-40s.

---

## Pipeline

### Before (fully sequential)

```
fetchOEmbed → fetchTranscript → generateAnthropicLesson (all-in-one, Sonnet) → save → ready
```

### After (parallel fetch + split generation)

```
t=0  fetchOEmbed ──────┐
t=0  fetchTranscript ──┘ → resolve together (~10-30s)
                               │
                   ┌───────────┴───────────┐
                   │                       │
          generateCore()         generateSecondary()
          Sonnet 4.6:             Haiku 4.5:
          segments + cards +      quiz + keyMoments
          scalar fields           (~8-12s)
          (~15-20s)
                   │                       │
            partial_ready ──→       patch → ready
            (redirect user)
```

**`generateCore`** produces: `segments`, `cards`, `watchScore`, `scoreReason`,
`difficulty`, `reallyAbout`, `bestPart`, `skipPart`, `recommendation`,
`watchVerdict`.

**`generateSecondary`** produces: `quiz`, `keyMoments`.

`tutorSeed` is parked — no longer generated. Old cached lessons keep their
existing data; new lessons get `null`.

Both generation calls fire with `Promise.allSettled` so a secondary failure
does not kill the core lesson.

---

## Data Model

### `lessonSchema.ts`

Three fields change:

```ts
tutorSeed:   z.array(TutorSeedItem).nullable().default(null),   // parked
quiz:        z.array(QuizQuestion).nullable().default(null),    // partial state
keyMoments:  z.array(KeyMoment).nullable().default(null),       // partial state
```

No DB migration needed. The lessons table stores a JSON blob; nullable fields
are forward-compatible with existing cached lessons.

### `IngestPhase`

```ts
export type IngestPhase =
  | "idle"
  | "processing"
  | "partial_ready"   // ← new: core done, secondary in-flight
  | "ready"
  | "failed";
```

`getIngestStatus` returns `partial_ready` when the job row has that status.

### Store — new method

```ts
patchLesson(youtubeId: string, patch: { quiz: QuizQuestion[]; keyMoments: KeyMoment[] }): Promise<void>
```

Merges `quiz` and `keyMoments` into the existing lesson row without
overwriting core fields. Called once `generateSecondary` resolves.

---

## `processLesson.server.ts` changes

1. Replace sequential `fetchOEmbed` / `fetchTranscript` awaits with
   `Promise.all([fetchOEmbed(youtubeId), fetchTranscript(youtubeId)])`.

2. Fire `generateCore` and `generateSecondary` concurrently with
   `Promise.allSettled`.

3. When `generateCore` resolves:
   - Merge video facts into lesson (same overwrite logic as today).
   - `store.saveLesson({ youtubeId, lesson })` — lesson has `quiz: null`,
     `keyMoments: null`, `tutorSeed: null`.
   - `store.updateProcessingJob(jobId, { status: "partial_ready", currentStep: "partial_ready" })`.

4. When `generateSecondary` resolves (or rejects):
   - If resolved: `store.patchLesson(youtubeId, { quiz, keyMoments })` then
     `status: "ready"`.
   - If rejected: log the failure, leave lesson as-is. The job stays
     `partial_ready`; the UI timeout (see below) handles the fallback.

5. The heartbeat interval covers both calls — no change needed there.

---

## `anthropicLesson.server.ts` changes

Split into two exported functions in the same file:

**`generateCore(input)`** — Sonnet 4.6, `max_tokens: 8000`, prompt asks for
segments + cards + all scalar fields, explicitly omits quiz/keyMoments/tutorSeed.

**`generateSecondary(input)`** — Haiku 4.5, `max_tokens: 3000`, SDK
`timeout: 60_000` (Haiku is fast; a 60s hang means something is wrong),
prompt asks for quiz + keyMoments only, receives the same transcript. No
Anthropic key fallback needed — if Haiku is unavailable the
`Promise.allSettled` rejection path handles it.

Both functions share the same `transcriptText` helper and `languageDirective`.

---

## Progressive UI Reveal

### Processing page (`processing.$videoId.tsx`)

No change to the polling logic. The existing `getIngestStatus` poll fires every
2s. When it returns `partial_ready`, redirect to the lesson page — same
behaviour as `ready`.

### Lesson page (`lesson.$videoId.tsx`)

On mount, check `lesson.quiz === null`:

- If null: start polling `getIngestStatus` every 2s. When `phase === "ready"`,
  call `getLessonByYoutubeId` to refetch and swap in `quiz` + `keyMoments`.
  Reuse the existing hook — no new infrastructure.
- Quiz section renders a skeleton + "Quiz loading…" label (`.vs-label` mono
  eyebrow style) while null.
- **Timeout guard:** if after 60s of polling `quiz` is still null, stop
  polling and render "Quiz unavailable" in place of the skeleton. Same copy
  voice as other error states; no mascot needed here.

### Tutor panel (`TutorPanel.tsx`)

When `lesson.tutorSeed === null`, the panel hides itself entirely (returns
`null`). No "coming soon" copy — just absent. This is consistent with the
existing conditional-render pattern in the component.

---

## Error handling

| Failure point | Behaviour |
|---|---|
| `fetchOEmbed` or `fetchTranscript` throws | Same as today — job fails with appropriate `IngestErrorCode` |
| `generateCore` throws | Job fails with `GENERATION_FAILURE` — no partial save |
| `generateSecondary` throws | Core lesson is saved as `partial_ready`; lesson page times out after 60s and shows "Quiz unavailable" |
| `patchLesson` throws | Log error; lesson stays partial; same 60s UI timeout |

---

## Testing

- Unit tests for `generateCore` and `generateSecondary` prompt builders (same
  pattern as existing `lessonPrompt.test.ts`).
- Unit test for `patchLesson` store method.
- Schema tests for nullable `quiz`, `keyMoments`, `tutorSeed` — ensure Zod
  accepts both null and populated arrays.
- Integration test for the `partial_ready → ready` job lifecycle (mock both
  generation calls).
- TutorPanel snapshot test: renders null when `tutorSeed` is null.

---

## Out of scope

- SSE / websockets — polling is sufficient for this phase.
- Quiz streaming mid-generation — Haiku is fast enough that skeleton-then-swap
  is indistinguishable from streaming at the output token rate.
- Re-enabling `tutorSeed` generation — separate feature, separate spec.
- Progressive reveal for cards (cards are in the core call, already fast).
