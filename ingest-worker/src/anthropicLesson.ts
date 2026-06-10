import Anthropic from "@anthropic-ai/sdk";
import { Lesson as LessonSchema, type Lesson } from "./schema.ts";
import type { Cue, Meta } from "./ingest.ts";

// Claude-backed lesson generation for the worker. Mirrors the inline
// src/lib/anthropicLesson.server.ts, but the worker runs on a box with NO
// 60s function cap, so it can afford the stronger model + a larger token
// budget (Opus 4.8, 32k) for higher-quality lessons. Streamed because the
// transcript is long input. The prompt enumerates the exact Lesson field
// names so the output parses against the shared Lesson schema.

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

function transcriptExcerpt(cues: Cue[]): string {
  const maxChars = 45_000;
  let out = "";
  for (const cue of cues) {
    const line = `[${Math.floor(cue.start)}s] ${cue.text.replace(/\s+/g, " ").trim()}\n`;
    if (out.length + line.length > maxChars) break;
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
}): Promise<Lesson> {
  // No Vercel 60s cap here, so a generous timeout is fine.
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 240_000, maxRetries: 1 });
  const model = input.model ?? "claude-opus-4-8";

  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system:
      "You generate trustworthy WatchLater lessons: a colour-coded attention map (segments), exactly six tappable lesson cards (thesis, key concept, mechanism, example/analogy, nuance, recap), a 3-question quiz (main idea, a supporting detail, an application), and a transcript-grounded tutor seed. Ground every major claim in transcript timestamps. Be blunt but not snarky about low-value videos. Your response text must be a SINGLE valid JSON object matching requiredShape EXACTLY — use those exact field names and enum values, no markdown fences, no preamble, no commentary.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "Create a six-card interactive lesson for this YouTube video, grounded in the transcript below. Return JSON exactly matching requiredShape (timestamps in seconds).",
          requiredShape: REQUIRED_SHAPE,
          meta: input.meta,
          transcript: transcriptExcerpt(input.cues),
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
