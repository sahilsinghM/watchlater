import { Lesson as LessonSchema, type Lesson } from "./lessonSchema";
import type { Cue, Meta } from "./buildLesson";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ text?: string; type?: string }>;
  }>;
};

function outputText(payload: OpenAIResponse): string {
  if (payload.output_text) return payload.output_text;
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

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

export async function generateOpenAILesson(input: {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
}): Promise<Lesson> {
  const model = input.model ?? "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You generate trustworthy VideoSense lessons. Return only valid JSON. Do not wrap it in markdown. Ground major claims in transcript timestamps. Be blunt but not snarky about low-value videos.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a six-card interactive lesson for this YouTube video.",
            requiredShape: {
              video: {
                id: "string",
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
              watchVerdict: "skip | lesson_only | watch_core | watch_full",
              visualContextStatus: "unavailable",
              segments: "array of skip/watch/core/demo segments with timestamps",
              cards: "exactly six cards covering thesis, key concept, mechanism, example/analogy, nuance, recap",
              keyMoments: "3-5 timestamp/caption moments",
              quiz: "3 questions: main idea, support/detail, application",
              tutorSeed: "source-grounded suggested Q/A pairs",
            },
            meta: input.meta,
            transcript: transcriptExcerpt(input.cues),
          }),
        },
      ],
      text: { format: { type: "json_object" } },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI generation failed: ${response.status}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const text = outputText(payload);
  const parsed = JSON.parse(text);
  return LessonSchema.parse(parsed);
}
