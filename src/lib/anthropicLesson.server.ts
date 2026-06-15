import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";
import { QuizQuestion, KeyMoment, Lesson as LessonSchema, type Lesson } from "./lessonSchema";
import { languageDirective } from "./lessonPrompt";
import type { Cue, Meta } from "./buildLesson";

// Claude-backed lesson generation, split into two concurrent calls:
//   generateCore  — Sonnet 4.6, produces segments + cards + scalar verdict fields
//   generateSecondary — Haiku 4.5, produces quiz + keyMoments
//
// Both receive the full transcript. Running them in parallel (see processLesson)
// cuts wall-clock generation time by ~50% compared to the old single call.
//
// SPEED MATTERS: the whole ingest pipeline runs inline inside one Vercel
// function with a 300s budget. Do NOT raise Sonnet to Opus / raise max_tokens
// beyond these values — Opus with a big budget routinely overran the function
// and was killed mid-write. Override the model per-deploy with ANTHROPIC_MODEL
// only with measured headroom.

// ─── Prompt shapes ────────────────────────────────────────────────────────────
// Exported so tests can assert exactly which fields each call requests.

export const CORE_REQUIRED_SHAPE = {
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
} as const;

export const SECONDARY_REQUIRED_SHAPE = {
  quiz: [
    {
      id: "string",
      prompt: "string",
      options: "string[] (>=2)",
      correctIndex: "number (0-based)",
      explanation: "string",
    },
  ],
  keyMoments: [{ timestamp: "number (sec)", caption: "string" }],
} as const;

// Local parse boundary for the secondary call — a malformed Haiku response
// fails cleanly here rather than corrupting the lesson row.
export const SecondaryOutputSchema = z.object({
  quiz: z.array(QuizQuestion),
  keyMoments: z.array(KeyMoment),
});
export type SecondaryOutput = z.infer<typeof SecondaryOutputSchema>;

// ─── Shared helpers ───────────────────────────────────────────────────────────

const TRANSCRIPT_CHAR_BUDGET = 700_000;

export function transcriptText(cues: Cue[], durationSeconds: number): string {
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
    ? t
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    : t;
}

function parseJsonSafe(text: string): unknown {
  const stripped = stripJsonFence(text);
  try {
    return JSON.parse(stripped);
  } catch {
    // LLM output was truncated or malformed — attempt structural repair before giving up
    return JSON.parse(jsonrepair(stripped));
  }
}

async function streamToText(stream: ReturnType<Anthropic["messages"]["stream"]>): Promise<string> {
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === "text")
    .map((b: Anthropic.TextBlock) => b.text)
    .join("");
  if (!text.trim()) throw new Error("Anthropic returned an empty response");
  return text;
}

// ─── Core generation — Sonnet 4.6 ─────────────────────────────────────────────

export async function generateCore(input: {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  durationSeconds: number;
  languageCode: string;
}): Promise<Lesson> {
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 120_000, maxRetries: 1 });
  const model = input.model ?? "claude-sonnet-4-6";

  const stream = client.messages.stream({
    model,
    max_tokens: 12000,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system:
      "You generate trustworthy WatchLater lessons: a colour-coded attention map (segments), exactly six tappable lesson cards (thesis, key concept, mechanism, example/analogy, nuance, recap). Ground every major claim in transcript timestamps. TIME FORMAT RULE: numeric timestamp FIELDS are raw seconds, but any time you mention inside prose text must be written as a clock time exactly as the YouTube player shows it — '12:26' or '1:05:30' — NEVER raw seconds like '746s'. Be blunt but not snarky about low-value videos. Your response text must be a SINGLE valid JSON object matching requiredShape EXACTLY — use those exact field names and enum values, no markdown fences, no preamble, no commentary. " +
      languageDirective(input.languageCode),
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "Create a six-card interactive lesson for this YouTube video, grounded in the transcript below. Return JSON exactly matching requiredShape (timestamps in seconds). segments must cover the FULL video duration.",
          requiredShape: CORE_REQUIRED_SHAPE,
          meta: input.meta,
          durationSeconds: Math.floor(input.durationSeconds),
          transcriptLanguage: input.languageCode,
          transcript: transcriptText(input.cues, input.durationSeconds),
        }),
      },
    ],
  });

  const text = await streamToText(stream);
  const parsed = parseJsonSafe(text);
  try {
    return LessonSchema.parse({ ...(parsed as object), quiz: null, keyMoments: null, tutorSeed: null });
  } catch (e) {
    console.error("[anthropic/core] schema validation failed:", text.substring(0, 2000));
    throw e;
  }
}

// ─── Secondary generation — Haiku 4.5 ────────────────────────────────────────

export async function generateSecondary(input: {
  apiKey: string;
  meta: Meta;
  cues: Cue[];
  durationSeconds: number;
  languageCode: string;
}): Promise<SecondaryOutput> {
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 60_000, maxRetries: 1 });

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system:
      "You generate the quiz and key moments for a WatchLater lesson. Ground quiz questions and key moment captions in specific transcript timestamps. TIME FORMAT RULE: inside prose text use clock format ('12:26') not raw seconds. Your response must be a SINGLE valid JSON object matching requiredShape EXACTLY — no markdown fences, no preamble. " +
      languageDirective(input.languageCode),
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "Create a 3-question quiz (main idea, a supporting detail, an application) and 3-5 key moments for this YouTube video. Return JSON exactly matching requiredShape.",
          requiredShape: SECONDARY_REQUIRED_SHAPE,
          meta: input.meta,
          durationSeconds: Math.floor(input.durationSeconds),
          transcriptLanguage: input.languageCode,
          transcript: transcriptText(input.cues, input.durationSeconds),
        }),
      },
    ],
  });

  const text = await streamToText(stream);
  const parsed = parseJsonSafe(text);
  try {
    return SecondaryOutputSchema.parse(parsed);
  } catch (e) {
    console.error("[anthropic/secondary] schema validation failed:", text.substring(0, 2000));
    throw e;
  }
}
