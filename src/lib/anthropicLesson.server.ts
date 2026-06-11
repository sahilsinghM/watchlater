import Anthropic from "@anthropic-ai/sdk";
import { Lesson as LessonSchema, type Lesson } from "./lessonSchema";
import type { Cue, Meta } from "./buildLesson";

// Claude-backed lesson generation. Uses the official Anthropic SDK with Sonnet
// 4.6 by default, thinking disabled, and effort=low — a single-shot structured
// JSON task needs speed and a guaranteed text block, not reasoning (see the
// thinking comment on the request below). Streamed because the transcript is
// long input, which avoids request timeouts (see the claude-api skill). The prompt
// enumerates the exact Lesson field names so the output parses against
// LessonSchema — the SDK's structured-outputs helper requires Zod v4 and this
// project is on Zod v3.
//
// SPEED MATTERS: the whole ingest pipeline runs inline inside one Vercel
// function, which on the Hobby plan is hard-capped at 60s. Sonnet 4.6 + a
// bounded max_tokens keeps generation well under that. Do NOT raise these back
// to Opus / 32k tokens without first moving generation off the 60s function
// (raise maxDuration on Pro, or use the ingest-worker escape hatch) — Opus with
// a 32k budget routinely overran 60s and the function was killed mid-write,
// leaving the job stuck and the user on a spinner that timed out. Override the
// model per-deploy with ANTHROPIC_MODEL if you have the headroom.

// Mirrors src/lib/lessonSchema.ts exactly — keep in sync if the schema changes.
const REQUIRED_SHAPE = {
  video: {
    id: "string",
    youtubeId: "string",
    url: "string",
    title: "string",
    channel: "string",
    duration: "number (seconds)",
    thumbnail: "string",
  },
  watchScore: "number 0-10 (low scores allowed)",
  scoreReason: "string, grounded in the transcript",
  difficulty: '"Beginner" | "Intermediate" | "Advanced"',
  reallyAbout: "string",
  bestPart: { start: "number (sec)", end: "number (sec)", why: "string" },
  skipPart: { start: "number (sec)", end: "number (sec)", why: "string" },
  recommendation: "string, explicit verdict and reason",
  watchVerdict: '"skip" | "lesson_only" | "watch_core" | "watch_full"',
  visualContextStatus: '"unavailable"',
  segments: [
    {
      start: "number (sec)",
      end: "number (sec)",
      kind: '"skip" | "watch" | "core" | "demo"',
      title: "string",
      blurb: "string",
    },
  ],
  cards: [
    {
      id: "string",
      kind: '"concept" | "analogy" | "quote" | "insight" | "recap"',
      title: "string",
      body: "string",
      analogy: "string (optional)",
      quote: "string (optional)",
      quoteAuthor: "string (optional)",
      timestamp: "number sec (optional)",
    },
  ],
  keyMoments: [{ timestamp: "number (sec)", caption: "string" }],
  quiz: [
    {
      id: "string",
      prompt: "string",
      options: "string[] (>=2)",
      correctIndex: "number (0-based)",
      explanation: "string",
    },
  ],
  tutorSeed: [{ q: "string", a: "string" }],
} as const;

// Render the FULL transcript. Sonnet 4.6 has a 1M-token context; even a
// 12-hour podcast transcript is ~650k chars (~170k tokens), so whole-video
// coverage costs well under $1 of input and needs no map-reduce machinery.
// The previous 45k-char cap silently amputated everything past ~50 minutes
// of speech — the lesson then claimed the video *was* that long.
//
// The budget below is a safety rail for pathological transcripts, sized so it
// can only trip beyond the 12h duration cap. If it ever trips, the model is
// told exactly where coverage stops so it doesn't fabricate the tail.
const TRANSCRIPT_CHAR_BUDGET = 700_000;

function transcriptText(cues: Cue[], durationSeconds: number): string {
  let out = "";
  for (const cue of cues) {
    const line = `[${Math.floor(cue.start)}s] ${cue.text.replace(/\s+/g, " ").trim()}\n`;
    if (out.length + line.length > TRANSCRIPT_CHAR_BUDGET) {
      out += `[TRANSCRIPT TRUNCATED HERE — the video continues to ${Math.floor(durationSeconds)}s; do not describe or segment content you have not seen]\n`;
      break;
    }
    out += line;
  }
  return out;
}

// Strip an accidental ```json fence so a stray wrapper doesn't fail a valid lesson.
function stripJsonFence(text: string): string {
  const t = text.trim();
  return t.startsWith("```")
    ? t
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    : t;
}

export async function generateAnthropicLesson(input: {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  durationSeconds: number;
}): Promise<Lesson> {
  // 120s SDK timeout (bounds connection + time-to-first-event; default is
  // 10 min). Multi-hour transcripts mean ~100k+ tokens of prefill, so first
  // byte can take tens of seconds — but a run that hasn't STARTED after 120s
  // should abort as a clean GENERATION_FAILURE while the Vercel function
  // (300s budget) still has time to write the failure to the job row. With
  // maxRetries:1 the worst case is ~240s before our catch runs — inside cap.
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 120_000, maxRetries: 1 });
  const model = input.model ?? "claude-sonnet-4-6";

  const stream = client.messages.stream({
    model,
    // Bounded headroom for the lesson JSON (~3-4k tokens). Big enough to avoid
    // truncating mid-array, small enough to stay fast.
    max_tokens: 12000,
    // Thinking must stay OFF for this call. Adaptive thinking shares the
    // max_tokens budget with the visible output; on long transcripts the model
    // could spend the entire 12k budget thinking and end at max_tokens with
    // zero text blocks — surfacing as "Anthropic returned an empty response"
    // (GENERATION_FAILURE) after minutes of streaming. The SDK timeout does not
    // guard against this: it bounds time-to-first-byte, not an active stream.
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system:
      "You generate trustworthy WatchLater lessons: a colour-coded attention map (segments), exactly six tappable lesson cards (thesis, key concept, mechanism, example/analogy, nuance, recap), a 3-question quiz (main idea, a supporting detail, an application), and a transcript-grounded tutor seed. Ground every major claim in transcript timestamps. Be blunt but not snarky about low-value videos. Your response text must be a SINGLE valid JSON object matching requiredShape EXACTLY — use those exact field names and enum values, no markdown fences, no preamble, no commentary.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "Create a six-card interactive lesson for this YouTube video, grounded in the transcript below. Return JSON exactly matching requiredShape (timestamps in seconds). segments must cover the FULL video duration.",
          requiredShape: REQUIRED_SHAPE,
          meta: input.meta,
          durationSeconds: Math.floor(input.durationSeconds),
          transcript: transcriptText(input.cues, input.durationSeconds),
        }),
      },
    ],
  });

  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new Error("Anthropic returned an empty response");

  const parsed = JSON.parse(stripJsonFence(text));
  try {
    return LessonSchema.parse(parsed);
  } catch (e) {
    console.error("[anthropic] schema validation failed, response text:", text.substring(0, 2000));
    throw e;
  }
}
