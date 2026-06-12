// NOTE: this templated fallback only runs when no LLM key is configured (a
// dev/no-key environment — see processLesson.server.ts). For non-English
// transcripts it intentionally emits English scaffolding around
// transcript-language excerpts; the LLM paths handle language properly.
import type { Lesson, Segment, LessonCard, CardKind } from "./lessonSchema";
import { Lesson as LessonSchema, fmtRange } from "./lessonSchema";

export type Cue = { start: number; dur: number; text: string };
export type Meta = {
  youtubeId: string;
  title: string;
  channel: string;
  thumbnail: string;
};

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const SEG_LABELS: Segment["kind"][] = ["skip", "watch", "core", "demo", "watch", "skip"];
const SEG_TITLES: Record<Segment["kind"], string> = {
  skip: "Intro / fluff",
  watch: "Useful context",
  core: "Core argument",
  demo: "Demo / examples",
};
const SEG_BLURBS: Record<Segment["kind"], string> = {
  skip: "Setup or recap. Skim or skip.",
  watch: "Useful background that frames the core idea.",
  core: "The main argument of the video. Worth watching.",
  demo: "Concrete examples and walkthroughs.",
};

const CARD_ORDER: CardKind[] = ["concept", "analogy", "insight", "quote", "concept", "recap"];

function pickCards(cues: Cue[], duration: number): Cue[] {
  // Pick 6 cues with the longest text, from middle 70% of the video.
  const lo = duration * 0.15;
  const hi = duration * 0.85;
  const inMiddle = cues.filter((c) => c.start >= lo && c.start <= hi);
  const pool = inMiddle.length >= 6 ? inMiddle : cues;
  const ranked = [...pool].sort((a, b) => b.text.length - a.text.length).slice(0, 24);
  // Re-sort by time and downsample to 6 evenly spaced picks.
  const sorted = ranked.sort((a, b) => a.start - b.start);
  const out: Cue[] = [];
  const stride = Math.max(1, Math.floor(sorted.length / 6));
  for (let i = 0; out.length < 6 && i < sorted.length; i += stride) out.push(sorted[i]);
  // Pad with real cues when fewer than 6 fall in the quality band.
  while (out.length < 6 && cues.length > 0)
    out.push(cues[Math.min(cues.length - 1, out.length * 10)]);
  return out.slice(0, 6);
}

function trimTo(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function buildLesson(meta: Meta, cues: Cue[]): Lesson {
  if (cues.length === 0)
    throw new Error("buildLesson requires at least 1 cue — run assessTranscriptQuality first");
  const duration = cues.length
    ? Math.max(60, Math.ceil(cues[cues.length - 1].start + (cues[cues.length - 1].dur || 4)))
    : 600;

  // Segments — chunk into 6 equal slices.
  const segments: Segment[] = SEG_LABELS.map((kind, i) => {
    const start = Math.floor((duration * i) / SEG_LABELS.length);
    const end = Math.floor((duration * (i + 1)) / SEG_LABELS.length);
    return { start, end, kind, title: SEG_TITLES[kind], blurb: SEG_BLURBS[kind] };
  });

  const core = segments.find((s) => s.kind === "core")!;
  const skip = segments.find((s) => s.kind === "skip")!;

  // Cards
  const picks = pickCards(cues, duration);
  const cards: LessonCard[] = picks.map((c, i) => {
    const kind = CARD_ORDER[i] ?? "insight";
    const body = trimTo(cleanText(c.text), 280);
    const titleSource = cleanText(c.text).split(/[.!?]/)[0] || meta.title;
    const title = trimTo(titleSource, 70);
    const card: LessonCard = {
      id: `c${i + 1}`,
      kind,
      title,
      body,
      timestamp: Math.floor(c.start),
    };
    if (kind === "analogy") card.analogy = `Think of it like this: ${body}`;
    if (kind === "quote") {
      card.quote = body;
      card.quoteAuthor = meta.channel;
    }
    return card;
  });

  const keyMoments = cards
    .filter((c) => c.timestamp !== undefined)
    .slice(0, 4)
    .map((c) => ({ timestamp: c.timestamp!, caption: c.title }));

  const watchScore = Math.round((6 + Math.min(4, cues.length / 200)) * 10) / 10;
  // scoreReason explains this is a density estimate, not an AI quality judgment.

  // Quiz — templated against real card titles.
  const distractors = [
    "It's a tangent the speaker walks back later",
    "It's mentioned only in passing",
    "It's never actually addressed",
  ];
  const quiz = cards.slice(0, 3).map((c, i) => ({
    id: `q${i + 1}`,
    prompt: `According to the video, which best matches: “${trimTo(c.title, 80)}”?`,
    options: [
      trimTo(c.body, 120),
      distractors[i % distractors.length],
      distractors[(i + 1) % distractors.length],
      "None of the above",
    ],
    correctIndex: 0,
    explanation: `The speaker makes this point around ${Math.floor((c.timestamp ?? 0) / 60)}:${String(
      Math.floor((c.timestamp ?? 0) % 60),
    ).padStart(2, "0")}.`,
  }));

  const reallyAbout =
    `This video by ${meta.channel} runs ${Math.floor(duration / 60)} minutes. ` +
    `The core argument lives in ${fmtRange(core.start, core.end)} — the rest is setup and recap. ` +
    `(Density-based lesson — AI analysis pending.)`;

  const lesson: Lesson = {
    video: {
      id: meta.youtubeId,
      youtubeId: meta.youtubeId,
      url: `https://www.youtube.com/watch?v=${meta.youtubeId}`,
      title: meta.title,
      channel: meta.channel,
      duration,
      thumbnail: meta.thumbnail,
    },
    watchScore,
    scoreReason: `Density estimate: ${cues.length} transcript cues over ${Math.floor(duration / 60)} minutes. AI analysis pending.`,
    difficulty: cues.length > 800 ? "Advanced" : cues.length > 300 ? "Intermediate" : "Beginner",
    reallyAbout,
    bestPart: {
      start: core.start,
      end: core.end,
      why: "Where the speaker stops setting up and makes the actual point.",
    },
    skipPart: {
      start: skip.start,
      end: skip.end,
      why: "Intro, definitions, and housekeeping. Skim or skip.",
    },
    recommendation: `Do the 5-minute lesson first. If you want depth, jump to ${fmtRange(core.start, core.end)}.`,
    watchVerdict: watchScore >= 8 ? "watch_full" : watchScore >= 6 ? "watch_core" : "lesson_only",
    visualContextStatus: "unavailable",
    segments,
    cards,
    keyMoments,
    quiz,
    tutorSeed: [
      {
        q: "Is this video worth watching in full?",
        a: `Mostly no. The first and last sixths are setup and recap. The core is ${fmtRange(core.start, core.end)} — that's the part the lesson covers.`,
      },
      {
        q: "Who is the speaker?",
        a: `This is from ${meta.channel}. The video is titled “${meta.title}”.`,
      },
      {
        q: "What's the single biggest takeaway?",
        a: cards[0]
          ? `“${cards[0].title}.” The speaker develops this around ${fmtRange(cards[0].timestamp ?? 0, (cards[0].timestamp ?? 0) + 60)}.`
          : "The lesson cards cover the main takeaways in order.",
      },
    ],
  };

  return LessonSchema.parse(lesson);
}
