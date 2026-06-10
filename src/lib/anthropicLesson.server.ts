import Anthropic from "@anthropic-ai/sdk";
import { Lesson as LessonSchema, type Lesson } from "./lessonSchema";
import type { Cue, Meta } from "./buildLesson";

// Claude-backed lesson generation. Uses the official Anthropic SDK, Opus 4.8,
// and adaptive thinking (reasoning goes into thinking blocks; the text block is
// the clean JSON lesson). Streamed because the transcript is long input, which
// avoids request timeouts (see the claude-api skill). The prompt enumerates the
// exact Lesson field names so the output parses against LessonSchema — the SDK's
// structured-outputs helper requires Zod v4 and this project is on Zod v3.

// Mirrors src/lib/lessonSchema.ts exactly — keep in sync if the schema changes.
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

// Strip an accidental ```json fence so a stray wrapper doesn't fail a valid lesson.
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
  // 90s client timeout (the SDK default is 10 min) so a hung generation fails
  // fast and surfaces as an error instead of stalling the processing page.
  const client = new Anthropic({ apiKey: input.apiKey, timeout: 90_000, maxRetries: 1 });
  const model = input.model ?? "claude-opus-4-8";

  const stream = client.messages.stream({
    model,
    // Generous ceiling: thinking + the full lesson JSON must both fit, or the
    // JSON truncates mid-array and fails to parse. ~50s well under the 300s
    // function budget. Reasoning lands in thinking blocks; the text block is JSON.
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
    console.error("[anthropic] schema validation failed, response text:", text.substring(0, 2000));
    throw e;
  }
}
