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
            ↓ partial save         ↓ patch + persistKeyFrames
            partial_ready ──→           ready
            (redirect user)
```

**`generateCore`** produces: `segments`, `cards`, `watchScore`, `scoreReason`,
`difficulty`, `reallyAbout`, `bestPart`, `skipPart`, `recommendation`,
`watchVerdict`.

**`generateSecondary`** produces: `quiz`, `keyMoments`.

Both receive the **full transcript** (same `transcriptText` helper). Haiku
input is cheap enough (~$0.25/MTok) that doubling input tokens is worth the
quality benefit of full coverage.

`tutorSeed` is parked — no longer generated. Old cached lessons keep their
existing data; new lessons get `null`.

The OpenAI/OpenRouter fallback path keeps the **old single-call pattern**
unchanged. The parallel split only applies when `anthropicApiKey` is set.

---

## Concurrency pattern

Use chained `.then` on each promise so saves happen immediately when each
call resolves, not after both settle:

```ts
const corePromise = generateCore(...).then(async (core) => {
  const lesson = { ...core, quiz: null, keyMoments: null, tutorSeed: null };
  await store.saveLesson({ youtubeId, lesson });
  await store.updateProcessingJob(jobId, { status: "partial_ready", currentStep: "partial_ready" });
  return lesson;
});

const secondaryPromise = generateSecondary(...).then(async ({ quiz, keyMoments }) => {
  const { isVisuallyDependent } = detectVisualDependency(coreLesson.segments);
  const frameResult = await persistKeyFrames(store, {
    videoId, youtubeId, moments: keyMoments,
    captureAvailable: false,
    visualsEssential: isVisuallyDependent,
  });
  const visualContextStatus = frameResult.status === "failed" ? "unavailable" : frameResult.status;
  await store.patchLesson(youtubeId, { quiz, keyMoments, visualContextStatus });
  await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
});

// Wait for both before returning — keeps the Vercel function alive
await Promise.allSettled([corePromise, secondaryPromise]);
```

If `generateSecondary` rejects: `persistKeyFrames` is skipped entirely, the
lesson remains `partial_ready`, and `visualContextStatus` stays `"unavailable"`
(the default already set by the core save). The lesson page's 60s timeout
guard handles the fallback UI.

---

## Data Model

### `lessonSchema.ts`

Three fields change:

```ts
tutorSeed:   z.array(TutorSeedItem).nullable().default(null),   // parked
quiz:        z.array(QuizQuestion).nullable().default(null),    // partial state
keyMoments:  z.array(KeyMoment).nullable().default(null),       // partial state
```

No DB migration needed. The lessons table stores a `jsonb` blob; nullable
fields are forward-compatible with existing cached lessons.

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
The `status` column is unconstrained `text` — no DB migration needed.

### Store — new methods

**`patchLesson`** — merges secondary fields into the existing `jsonb` row
using Postgres's `||` merge operator (single round-trip, atomic):

```ts
patchLesson(
  youtubeId: string,
  patch: { quiz: QuizQuestion[]; keyMoments: KeyMoment[]; visualContextStatus: string }
): Promise<void>
// → UPDATE lessons SET lesson_json = lesson_json || $patch WHERE youtube_id = $id
```

**`touchJob`** — bumps `updated_at` only, no status change. Used by the
heartbeat so it doesn't overwrite `partial_ready` back to `generating_lesson`:

```ts
touchJob(jobId: string): Promise<void>
// → UPDATE processing_jobs SET updated_at = now() WHERE id = $id
```

---

## `processLesson.server.ts` changes

1. `Promise.all([fetchOEmbed(youtubeId), fetchTranscript(youtubeId)])` replaces
   the two sequential awaits.

2. Heartbeat calls `store.touchJob(jobId)` instead of `updateProcessingJob` —
   prevents overwriting `partial_ready` status. Heartbeat stays alive until
   `Promise.allSettled` resolves (covers both generation calls).

3. Chained `.then` pattern (see Concurrency pattern section above).

4. `detectVisualDependency` + `persistKeyFrames` move into the secondary
   `.then` chain (they require `keyMoments`). If secondary fails, both are
   skipped.

---

## `anthropicLesson.server.ts` changes

Split the existing `generateAnthropicLesson` into two exported functions:

**`generateCore(input)`** — Sonnet 4.6, `max_tokens: 8000`. Prompt explicitly
omits `quiz`, `keyMoments`, `tutorSeed`.

**`generateSecondary(input)`** — Haiku 4.5, `max_tokens: 3000`, SDK
`timeout: 60_000`. Prompt asks for `quiz` + `keyMoments` only. Parses against
a local (non-exported) `SecondaryOutputSchema`:

```ts
const SecondaryOutputSchema = z.object({
  quiz: z.array(QuizQuestion),
  keyMoments: z.array(KeyMoment),
});
```

Both share `transcriptText`, `languageDirective`, and `stripJsonFence`.

---

## Progressive UI Reveal

### Processing page (`processing.$videoId.tsx`)

Two small changes:
- `refetchInterval` stops on `partial_ready` (same as `ready`)
- Navigate effect fires on `partial_ready` (same destination: `/lesson/$videoId`)

### Lesson page (`lesson.$videoId.tsx`)

On mount, `lesson.quiz === null` drives a polling query:

```ts
const lesson = useLoaderData({ from: '/lesson/$videoId' });

const statusQuery = useQuery({
  queryKey: ['ingest-status', videoId],
  queryFn: () => getIngestStatus({ data: { youtubeId: videoId } }),
  enabled: lesson.quiz === null,        // no-op for already-complete lessons
  refetchInterval: (q) => {
    if (lesson.quiz !== null) return false;
    const phase = q.state.data?.phase;
    return phase === 'ready' || phase === 'failed' ? false : 2000;
  },
});

useEffect(() => {
  if (statusQuery.data?.phase === 'ready') router.invalidate();
}, [statusQuery.data?.phase]);
```

After `router.invalidate()`, the loader re-runs, `lesson.quiz` becomes
non-null, `enabled` flips false, and the poll stops automatically.

**Timeout guard:** if after 60s of polling `quiz` is still null, stop
polling and render "Quiz unavailable" in place of the skeleton. Same copy
voice as other error states; no mascot.

### UI null states

- **Quiz section** — skeleton + "QUIZ LOADING" `.vs-label` eyebrow while
  `lesson.quiz === null`; "Quiz unavailable" on timeout
- **`keyMoments`** — not rendered in any UI component (server-side only, used
  by `persistKeyFrames`)
- **`TutorPanel`** — returns `null` when `lesson.tutorSeed === null`; no copy,
  just absent

---

## Error handling

| Failure point | Behaviour |
|---|---|
| `fetchOEmbed` or `fetchTranscript` throws | Job fails with appropriate `IngestErrorCode` — same as today |
| `generateCore` throws | Job fails with `GENERATION_FAILURE` — no partial save |
| `generateSecondary` throws | Core lesson stays `partial_ready`; `persistKeyFrames` skipped; lesson page times out after 60s → "Quiz unavailable" |
| `patchLesson` throws | Log error; lesson stays partial; same 60s UI timeout |
| `touchJob` throws | Swallow — heartbeat failure is non-fatal; `isJobStale` will eventually time out if the job truly hangs |

---

## Testing

- Unit tests for `generateCore` and `generateSecondary` prompt shape (pattern:
  `lessonPrompt.test.ts`)
- `SecondaryOutputSchema` parse tests — valid and invalid shapes
- Schema tests: `quiz`, `keyMoments`, `tutorSeed` accept both `null` and
  populated arrays
- `patchLesson` store unit test — verifies jsonb merge doesn't overwrite core fields
- `touchJob` store unit test
- Integration test: `partial_ready → ready` job lifecycle with both generation
  calls mocked
- Processing page: redirects on `partial_ready`
- Lesson page: quiz skeleton renders when null; poll stops after `router.invalidate()`
- TutorPanel: renders null when `tutorSeed` is null

---

## Out of scope

- SSE / websockets — polling is sufficient
- Quiz streaming mid-generation — skeleton-then-swap is imperceptible at Haiku's output rate
- Re-enabling `tutorSeed` generation — separate spec
- Progressive reveal for cards — cards are in the core call, already fast
- OpenAI path parallelisation — fallback only, not worth the complexity
