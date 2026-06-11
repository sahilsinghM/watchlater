import Anthropic from "@anthropic-ai/sdk";
import { Lesson as LessonSchema, type Lesson } from "./schema.ts";
import type { Cue, Meta } from "./ingest.ts";

// Claude-backed lesson generation for the worker. Mirrors the inline
// src/lib/anthropicLesson.server.ts exactly: Sonnet 4.6 default, thinking
// DISABLED + effort "low", full-transcript prompting. Thinking must stay off —
// it shares the max_tokens budget with the visible output, and adaptive
// thinking on long transcripts repeatedly burned the whole budget and returned
// zero text blocks ("Anthropic returned an empty response"). The worker has no
// request cap, so a stronger model may be opted into per-deploy via
// ANTHROPIC_MODEL, but the DEFAULT must match inline so lesson quality is
// consistent regardless of which path built it. The prompt enumerates the
// exact Lesson field names so the output parses against the shared schema.

const REQUIRED_SHAPE = {
  video: {
    id: "string", youtubeId: "string", url: "string", title: "string",
    channel: "string", duration: "number (seconds)", thumbnail: "string",
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
    { start: "number (sec)", end: "number (sec)", kind: '"skip" | "watch" | "core" | "demo"', title: "string", blurb: "string" },
  ],
  cards: [
    { id: "string", kind: '"concept" | "analogy" | "quote" | "insight" | "recap"', title: "string", body: "string", analogy: "string (optional)", quote: "string (optional)", quoteAuthor: "string (optional)", timestamp: "number sec (optional)" },
  ],
  keyMoments: [{ timestamp: "number (sec)", caption: "string" }],
  quiz: [{ id: "string", prompt: "string", options: "string[] (>=2)", correctIndex: "number (0-based)", explanation: "string" }],
  tutorSeed: [{ q: "string", a: "string" }],
} as const;

// Render the FULL transcript (mirrors inline). Sonnet 4.6 has a 1M-token
// context; even a 12-hour transcript is ~650k chars (~170k tokens). The budget
// is a safety rail sized to only trip beyond the 12h duration cap; if it ever
// trips, the model is told where coverage stops so it doesn't fabricate the tail.
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

function stripJsonFence(text: string): string {
  const t = text.trim();
  return t.startsWith("```")
    ? t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : t;
}

export async function generateAnthropicLesson(input: {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  durationSeconds: number;
}): Promise<Lesson> {
  // No request cap on the VPS, so a generous timeout is fine (bounds
  // connection + time-to-first-event; long prefills legitimately take a while).
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 240_000, maxRetries: 1 });
  const model = input.model ?? "claude-sonnet-4-6";

  const stream = client.messages.stream({
    model,
    // Bounded headroom for the lesson JSON (~3-4k tokens) — matches inline.
    max_tokens: 12000,
    // See header comment: thinking must stay disabled.
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
    console.error("[worker/anthropic] schema validation failed, response text:", text.substring(0, 2000));
    throw e;
  }
}
