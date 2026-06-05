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
  keyMoments: z.array(KeyMoment),
  quiz: z.array(QuizQuestion),
  tutorSeed: z.array(TutorSeedQA),
});
export type Lesson = z.infer<typeof Lesson>;

export type Tone = "clear" | "friendly" | "funny" | "strict";

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function fmtRange(a: number, b: number): string {
  return `${fmtTime(a)}–${fmtTime(b)}`;
}
