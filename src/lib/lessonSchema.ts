import { z } from "zod";

export const SegmentKind = z.enum(["skip", "watch", "core", "demo"]);
export type SegmentKind = z.infer<typeof SegmentKind>;

export const Segment = z.object({
  start: z.number(), // seconds
  end: z.number(),
  kind: SegmentKind,
  title: z.string(),
  blurb: z.string(),
});
export type Segment = z.infer<typeof Segment>;

export const CardKind = z.enum(["concept", "analogy", "quote", "insight", "recap"]);
export type CardKind = z.infer<typeof CardKind>;

export const LessonCard = z.object({
  id: z.string(),
  kind: CardKind,
  title: z.string(),
  body: z.string(),
  analogy: z.string().optional(),
  quote: z.string().optional(),
  quoteAuthor: z.string().optional(),
  timestamp: z.number().optional(), // seconds
});
export type LessonCard = z.infer<typeof LessonCard>;

export const QuizQuestion = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number(),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestion>;

export const KeyMoment = z.object({
  timestamp: z.number(),
  caption: z.string(),
});
export type KeyMoment = z.infer<typeof KeyMoment>;

export const TutorSeedQA = z.object({
  q: z.string(),
  a: z.string(),
});

export const Lesson = z.object({
  video: z.object({
    id: z.string(),
    youtubeId: z.string(),
    url: z.string(),
    title: z.string(),
    channel: z.string(),
    duration: z.number(), // seconds
    publishedAt: z.string().optional(),
    thumbnail: z.string(),
    // Transcript language (BCP-47-ish code from Supadata). Optional: lessons
    // persisted before any-language support (2026-06-12) don't carry it.
    language: z.string().optional(),
  }),
  watchScore: z.number(), // 0-10
  scoreReason: z.string(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  reallyAbout: z.string(),
  bestPart: z.object({ start: z.number(), end: z.number(), why: z.string() }),
  skipPart: z.object({ start: z.number(), end: z.number(), why: z.string() }),
  recommendation: z.string(),
  watchVerdict: z.enum(["skip", "lesson_only", "watch_core", "watch_full"]).optional(),
  visualContextStatus: z.enum(["captured", "degraded", "unavailable"]).optional(),
  segments: z.array(Segment),
  cards: z.array(LessonCard),
  keyMoments: z.array(KeyMoment).nullable().default(null),
  quiz: z.array(QuizQuestion).nullable().default(null),
  tutorSeed: z.array(TutorSeedQA).nullable().default(null),
});
export type Lesson = z.infer<typeof Lesson>;

export type Tone = "clear" | "friendly" | "funny" | "strict";

// Clock format exactly as the YouTube player shows it: "12:26", "8:37:26".
// No leading zero on the first unit, hours appear only past 60 minutes —
// previously a multi-hour video rendered as "517:26".
export function fmtTime(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function fmtRange(a: number, b: number): string {
  return `${fmtTime(a)}–${fmtTime(b)}`;
}
