import OpenAIBase from "openai";
import { PostHogOpenAI } from "@posthog/ai/openai";
import { Lesson as LessonSchema, type Lesson } from "./lessonSchema";
import { languageDirective } from "./lessonPrompt";
import type { Cue, Meta } from "./buildLesson";
import { getPostHogServer } from "./posthogServer.server";

function transcriptExcerpt(cues: Cue[]): string {
  const maxChars = 150_000;
  let out = "";
  for (const cue of cues) {
    const line = `[${Math.floor(cue.start)}s] ${cue.text.replace(/\s+/g, " ").trim()}\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out;
}

const SEGMENT_KIND_MAP: Record<string, string> = {
  intro: "watch",
  introduction: "watch",
  conclusion: "watch",
  outro: "watch",
  recap: "watch",
  overview: "watch",
  summary: "watch",
  transition: "watch",
  example: "demo",
  demonstration: "demo",
  tutorial: "demo",
  advertisement: "skip",
  filler: "skip",
  ad: "skip",
  boring: "skip",
  tangent: "skip",
  main: "core",
  key: "core",
  important: "core",
  essential: "core",
  critical: "core",
};

const CARD_KIND_MAP: Record<string, string> = {
  thesis: "concept",
  mechanism: "insight",
  nuance: "insight",
  key_concept: "concept",
  principle: "concept",
  theory: "concept",
  definition: "concept",
  example: "analogy",
  comparison: "analogy",
  metaphor: "analogy",
};

function normalizeModelOutput(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;

  if (Array.isArray(o.segments)) {
    for (const seg of o.segments as Record<string, unknown>[]) {
      const k = String(seg.kind ?? "").toLowerCase();
      if (!["skip", "watch", "core", "demo"].includes(k)) {
        seg.kind = SEGMENT_KIND_MAP[k] ?? "watch";
      }
    }
  }

  if (Array.isArray(o.cards)) {
    for (const card of o.cards as Record<string, unknown>[]) {
      const k = String(card.kind ?? "").toLowerCase();
      if (!["concept", "analogy", "quote", "insight", "recap"].includes(k)) {
        card.kind = CARD_KIND_MAP[k] ?? "concept";
      }
    }
  }

  if (typeof o.watchScore === "string") o.watchScore = parseFloat(o.watchScore);
  if (typeof o.video === "object" && o.video !== null) {
    const v = o.video as Record<string, unknown>;
    if (typeof v.duration === "string") v.duration = parseFloat(v.duration);
  }
}

const OPENROUTER_HEADERS = {
  "http-referer": "https://watchlater-sigma.vercel.app",
  "x-title": "WatchLater",
};

export async function generateOpenAILesson(input: {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  languageCode: string;
  youtubeId: string;
}): Promise<Lesson> {
  const model = input.model ?? "meta-llama/llama-3.3-70b-instruct";
  const phClient = getPostHogServer();

  const messages: OpenAIBase.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You generate trustworthy WatchLater lessons. Return only valid JSON. Do not wrap it in markdown. Ground major claims in transcript timestamps. Be blunt but not snarky about low-value videos. " +
        languageDirective(input.languageCode),
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Create a six-card interactive lesson for this YouTube video.",
        requiredShape: {
          video: {
            id: "use the youtubeId value here",
            youtubeId: "string",
            url: "string",
            title: "string",
            channel: "string",
            duration: "seconds number",
            thumbnail: "string",
          },
          watchScore: "0-10 number; low scores are allowed",
          scoreReason: "grounded reason",
          difficulty: "Beginner | Intermediate | Advanced",
          reallyAbout: "short explanation",
          bestPart: "{ start, end, why }",
          skipPart: "{ start, end, why }",
          recommendation: "explicit verdict and reason",
          watchVerdict:
            '"skip" | "lesson_only" | "watch_core" | "watch_full" (use exactly one of these strings)',
          visualContextStatus: "unavailable",
          segments:
            'array of objects: { start: number (seconds), end: number (seconds), kind: "skip"|"watch"|"core"|"demo", title: string, blurb: string }',
          cards:
            'exactly six objects: { id: string, kind: "concept"|"analogy"|"quote"|"insight"|"recap", title: string, body: string }. Cover thesis → concept, key concept → concept, mechanism → insight, example/analogy → analogy, nuance → insight, recap → recap.',
          keyMoments: "3-5 objects: { timestamp: number (seconds), caption: string }",
          quiz: "3 objects: { id: string, prompt: string, options: string[] (exactly 4 strings), correctIndex: number (0-3), explanation: string }",
          tutorSeed: '2-4 objects: { "q": "question string", "a": "answer string" }',
        },
        meta: input.meta,
        transcriptLanguage: input.languageCode,
        transcript: transcriptExcerpt(input.cues),
      }),
    },
  ];

  let raw: string;

  if (phClient) {
    const client = new PostHogOpenAI({
      apiKey: input.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: OPENROUTER_HEADERS,
      // .server.ts never runs in a browser; this flag silences the SDK's
      // environment check which false-positives in Bun's test runner.
      dangerouslyAllowBrowser: true,
      posthog: phClient,
    });
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      posthogDistinctId: input.youtubeId,
      posthogPrivacyMode: true,
    });
    raw = response.choices[0]?.message?.content ?? "";
  } else {
    const client = new OpenAIBase({
      apiKey: input.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: OPENROUTER_HEADERS,
      // Same rationale as above — .server.ts + Bun test runner.
      dangerouslyAllowBrowser: true,
    });
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    });
    raw = response.choices[0]?.message?.content ?? "";
  }

  if (!raw) throw new Error("OpenRouter returned empty response");
  // Some OpenRouter providers wrap JSON in markdown code fences despite json_object mode.
  const text = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(text);
  normalizeModelOutput(parsed);
  const result = LessonSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`);
    console.error(
      "[openai] schema validation failed:",
      issues.join(" | "),
      "| preview:",
      text.substring(0, 500),
    );
    throw result.error;
  }
  return result.data;
}
