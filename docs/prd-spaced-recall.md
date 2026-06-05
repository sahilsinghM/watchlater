# PRD: Spaced Application-Recall Loop

Source: `/office-hours` + `/autoplan` design doc (2026-06-05), branch `claude/zealous-lamport-WvaQY`.
Status: **BACKLOG — gated on manual-validation signal.** Not ready-for-agent yet (see Further Notes).

## Problem Statement

A student watches a long YouTube lecture or tutorial, screenshots it into Notion/OneNote, and never looks at the notes again. The knowledge doesn't stick and almost none of it reaches real life. Summaries (which every AI tool gives away free) make a faster version of the same note nobody re-reads. The founder's own words: "I do Duolingo everyday. hardly remember anything outside the app. i want to use things in real-life. no hook. only retention." The unserved job is retention that transfers to real life, not consumption or capture.

## Solution

From one studied video, generate a small set of application-framed recall prompts ("use this on your own problem", not "what did the speaker say") and drip them back to the learner spaced over a week, then ask once whether they actually used any of it in real life. The product optimizes for real-life transfer and unprompted return, not engagement-loop DAU.

For one studied video the learner gets: 5 application-framed recall prompts delivered on days 1, 2, 4, and 7, and a single real-life transfer check-in on day 8 ("did you actually use any of this? what happened?"). No accounts, no library — anonymous session keyed as today.

## User Stories

1. As a studying learner, I want prompts that ask me to apply an idea to my own problem, so that the knowledge transfers instead of sitting as a fact I forget.
2. As a learner, I want the prompts spaced across a week, so that spaced repetition does the retention work for me.
3. As a learner, I want a day-8 check-in asking if I used anything in real life, so that I notice (and report) actual transfer.
4. As a learner, I want to start from just a video URL with no signup, so that there's zero friction to try it.
5. As a learner, I want to give an email address as the only identifier, so that prompts can reach me without an account.
6. As a learner, I want to unsubscribe from the drip at any time, so that I'm never trapped in unwanted email.
7. As a learner, I want prompts grounded in what the video actually said, so that I'm never quizzed on something fabricated.
8. As a learner, I want the system to refuse rather than invent prompts when it can't read the transcript, so that I'm never sent low-quality or made-up content.
9. As a learner with a video that has no usable transcript, I want a clear failure, so that I don't get a degraded experience disguised as a real one.
10. As a learner, I want my prompt answers remembered, so that the check-in and any future prompts reflect what I already engaged with.
11. As a learner, I want the day-8 check-in to come after the drip completes, so that it's a real reflection on use, not a mid-stream interruption.
12. As a learner, I want each prompt to reference the moment in the video it came from, so that I can jump back if I need context.
13. As the founder, I want the prompt-generation quality to be measurable against hand-written prompts, so that I know the machine can match what worked manually.
14. As the founder, I want a generation run that produces too few or malformed prompts to NOT schedule a drip, so that no learner gets a half-empty week.
15. As the founder, I want email PII protected by row-level security, so that one learner can never read another's address or answers.
16. As the founder, I want a suppression list honored before every send, so that unsubscribes and bounces are never re-emailed (CAN-SPAM/GDPR).
17. As the founder, I want the scheduler to be idempotent, so that a re-run or overlapping cron never double-sends a day's prompt.
18. As the founder, I want out-of-order or late answers handled gracefully, so that a learner answering after the next prompt fires doesn't corrupt state.
19. As the founder, I want day-offset math anchored to the learner's enrollment in their timezone, so that "day 2" lands on the right calendar day.
20. As the founder, I want delivery problems (a fresh sending domain landing in spam) surfaced, so that "no engagement" isn't misread when the cause is deliverability.
21. As an operator, I want to see per-learner status (answered? / used-it? / asked-again?), so that I can read the demand signal at a glance.
22. As an operator, I want a learner who finishes the loop and returns to run a second video, so that I can observe retention behavior rather than a one-time fetch.

## Implementation Decisions

- **Separate `RecallPromptSet` schema, not bolted onto `Lesson`.** Open-ended application prompts share nothing structural with the existing multiple-choice `QuizQuestion` (`src/lib/lessonSchema.ts`). Define a new schema: `{ promptId, prompt, dayOffset, kind: "recall" | "transfer", sourceTimestamp? }`. (Autoplan Eng decision #5.)
- **New prompt-generation task, injected at the existing generator seam.** Mirror the `LessonGenerator` injection pattern already used by `generateAndPersistLesson` (`src/lib/mvpFlow.ts`). The recall-prompt generator is a separate LLM task (OpenAI, per ADR in `docs/decisions.md`), not the 3-question factual quiz.
- **Hard stop, never fabricate.** When the transcript is missing/unusable, generation must fail clearly — no synthetic-cue fallback. The current fallback (commit `fed6eeb`, `src/lib/ingest.functions.ts`) must be gated behind a dev-only flag before any deployed run, and must never feed the prompt generator. (Autoplan Eng decision #6; `docs/decisions.md` "no synthetic lessons".)
- **Generation validity gate.** The generator must return at least the required count of schema-valid prompts; on empty/malformed/too-few output, retry, then terminate to a "do not schedule" state rather than scheduling a partial drip. (Autoplan Eng decision #9.)
- **Persistence reuses the `MvpStore` seam.** Add recall-prompt-set, schedule, and response operations to the `MvpStore` type (`src/lib/mvpFlow.ts:107`), implemented in BOTH the memory store (`createMemoryMvpStore`) and the Supabase store (`src/lib/supabaseStore.server.ts`). Reuse `anonymous_sessions`; do NOT reuse `quiz_results` (its row shape is single-MCQ). New tables: `recall_schedules` (email, video, offsets, status, timezone, enrolled_at), `prompt_responses`, `email_sends` (idempotency), suppression list.
- **Schedule state machine.** Each scheduled send moves `scheduled → sent → responded`, with a unique constraint on `(schedule_id, day_offset)` so a cron re-run or overlap cannot double-send. Day-offset resolves against `enrolled_at` in the learner's timezone. (Autoplan Eng decision; story 17/19.)
- **Email is a net-new subsystem, not a ~1-day reuse.** Transactional send path (Resend/Postmark), double-opt-in capture, unsubscribe tokens, and suppression are required before any real send. (Autoplan Eng decision #10.)
- **Legal gating: RLS + consent before storing/sending.** Enable row-level security on every table holding email/answers; capture consent and provide unsubscribe before the first send. Build-blocking, not optional. (Autoplan Eng decision #8.)
- **Fix the pre-existing FK/uuid bug first.** `quiz_results.lesson_id` (a uuid FK) currently receives the client youtubeId string because `saveLesson` never returns the DB uuid (`src/lib/supabaseStore.server.ts`, `src/lib/feedback.functions.ts`). The new response tables would inherit this; fix `saveLesson` to return the real uuid and thread it through. (Autoplan Eng decision #7.)
- **Check-in is post-drip.** The day-8 transfer check-in is scheduled strictly after the day-7 prompt, as its own `kind: "transfer"` entry, not interleaved.

## Testing Decisions

- **Test external behavior at the highest existing seam.** Drive everything through the exported `mvpFlow` functions against `createMemoryMvpStore()` and a fake prompt generator — never assert on internal table layout or private helpers. Prior art: `src/lib/mvpFlow.test.ts` (`bun:test`, memory store, injected `LessonGenerator`).
- **Modules under test:** the recall-prompt generator wrapper (count/retry/terminal-state behavior), the schedule state machine (transitions + idempotency), day-offset/timezone resolution (pure function), suppression enforcement, and the `MvpStore` contract (same behavioral tests must pass against BOTH memory and Supabase implementations).
- **What a good test looks like here:** given N segments and a fake generator returning K prompts, assert the scheduled set and offsets; given a generator returning 0/malformed, assert "do not schedule" and no send rows; re-running the scheduler asserts zero additional `email_sends` (idempotency); an answer arriving after the next offset fires asserts state stays consistent.
- **Negative paths mirror happy paths:** missing transcript → hard-stop (no prompts, no schedule); unsubscribed address → no send; duplicate `(schedule_id, day_offset)` → rejected.

## Out of Scope

- Personal library, per-video FSRS decks, cross-video retention tracking, and accounts (Approach B — explicitly rejected for now).
- Choosing the final delivery channel (email is assumed; push/calendar/WhatsApp deferred to a later test).
- Deciding whether students vs professionals are the buyer (defer until one real user).
- Any redesign of the Tactile Field Guide system (locked in `docs/decisions.md`).
- The Attention map UI work (separate, already shipped in PR #12).

## Further Notes

- **This PRD is gated on a manual-validation signal and is NOT ready-for-agent.** The autoplan conclusion was explicit: before writing any build code, run the loop by hand this week with 3-5 real students (hand-written prompts, email by inbox, a spreadsheet). Build only if the signal is positive. Success bar: of 3-5 students, at least 2 who (a) answer prompts unprompted, (b) report real-life use at check-in, and (c) ask for the next video unprompted; even 1 of 5 is a lead worth chasing, 0 means revise the thesis before code.
- **The manual test proves demand and format, not generation quality.** A positive signal earns a second, separate test: machine-generated prompts vs hand-written, same loop. Prompt-generation quality is the primary technical risk and is independent of the demand risk.
- **Precondition for a clean test:** English-transcript videos, 5-90 min only — no 3-hour lectures or transcript-less uploads, which confound the signal with a content problem already known.
