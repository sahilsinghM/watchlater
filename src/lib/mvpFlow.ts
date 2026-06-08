import { Lesson as LessonSchema, type KeyMoment, type Lesson } from "./lessonSchema";
import { parseYouTubeId } from "./youtube";

export type ProcessingStatus =
  | "queued"
  | "fetching_metadata"
  | "reading_transcript"
  | "capturing_visuals"
  | "generating_lesson"
  | "ready"
  | "failed";

export type MvpErrorCode =
  | "INVALID_URL"
  | "SHORTS_UNSUPPORTED"
  | "PRIVATE_OR_BLOCKED"
  | "NO_TRANSCRIPT"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NON_ENGLISH"
  | "TRANSCRIPT_TOO_SPARSE"
  | "TRANSCRIPT_TOO_NOISY"
  | "SCREENSHOT_FAILURE"
  | "GENERATION_FAILURE"
  | "GENERATION_SCHEMA_INVALID"
  | "PERSISTENCE_FAILURE";

export type AnonymousSession = {
  id: string;
  sessionKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type ProcessingJob = {
  id: string;
  sessionId: string;
  youtubeId: string;
  input: string;
  status: ProcessingStatus;
  currentStep: ProcessingStatus;
  errorCode?: MvpErrorCode;
  errorDetail?: string;
  createdAt: string;
  updatedAt: string;
};

export type TranscriptCue = {
  start: number;
  dur: number;
  text: string;
};

export type TranscriptQualityInput = {
  durationSeconds: number;
  language?: string;
  cues: TranscriptCue[];
};

export type TranscriptQuality =
  | { ok: true; coverageRatio: number; cueDensity: number }
  | { ok: false; code: MvpErrorCode; detail: string; coverageRatio: number; cueDensity: number };

export type KeyFrame = {
  id: string;
  videoId: string;
  timestamp: number;
  caption: string;
  storagePath: string;
  status: "captured" | "degraded";
};

export type KeyFramePersistenceResult = {
  status: "captured" | "degraded" | "failed";
  frames: KeyFrame[];
  detail?: string;
};

export type LessonGenerationInput = {
  metadata: Lesson["video"];
  transcript: TranscriptCue[];
  keyFrames: KeyFrame[];
};

export type LessonGenerator = (input: LessonGenerationInput) => Promise<unknown>;

export type QuizResult = {
  id: string;
  lessonId: string;
  sessionId: string;
  answers: number[];
  score: number;
  total: number;
  completedAt: string;
};

export type Feedback = {
  id: string;
  lessonId: string;
  sessionId: string;
  useful: boolean;
  reason?: string;
  source: "completion" | "lesson" | "player";
  createdAt: string;
};

export type LeadSource = "hero" | "done";

export type Lead = {
  id: string;
  sessionId: string;
  email: string;
  source: LeadSource;
  lessonVideoId?: string;
  createdAt: string;
};

export type MvpStore = {
  upsertAnonymousSession(sessionKey: string): Promise<AnonymousSession>;
  getAnonymousSession(sessionKey: string): Promise<AnonymousSession | null>;
  createProcessingJob(input: {
    sessionId: string;
    youtubeId: string;
    rawInput: string;
  }): Promise<ProcessingJob>;
  getProcessingJob(id: string): Promise<ProcessingJob | null>;
  getActiveJobByYoutubeId(youtubeId: string): Promise<ProcessingJob | null>;
  updateProcessingJob(id: string, patch: Partial<ProcessingJob>): Promise<ProcessingJob>;
  saveKeyFrames(frames: KeyFrame[]): Promise<KeyFrame[]>;
  saveLesson(input: { youtubeId: string; lesson: Lesson }): Promise<Lesson>;
  getLessonByYoutubeId(youtubeId: string): Promise<Lesson | null>;
  saveQuizResult(input: Omit<QuizResult, "id" | "completedAt">): Promise<QuizResult>;
  saveFeedback(input: Omit<Feedback, "id" | "createdAt">): Promise<Feedback>;
  saveLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
};

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string, n: number): string {
  return `${prefix}_${n.toString().padStart(4, "0")}`;
}

export function createMemoryMvpStore(): MvpStore {
  const sessions = new Map<string, AnonymousSession>();
  const jobs = new Map<string, ProcessingJob>();
  const lessons = new Map<string, Lesson>();
  const quizResults: QuizResult[] = [];
  const feedback: Feedback[] = [];
  const leads: Lead[] = [];
  let sessionCount = 0;
  let jobCount = 0;
  let quizCount = 0;
  let feedbackCount = 0;
  let leadCount = 0;

  return {
    async upsertAnonymousSession(sessionKey) {
      const existing = sessions.get(sessionKey);
      const ts = now();
      if (existing) {
        const updated = { ...existing, lastSeenAt: ts };
        sessions.set(sessionKey, updated);
        return updated;
      }
      const session: AnonymousSession = {
        id: id("session", ++sessionCount),
        sessionKey,
        firstSeenAt: ts,
        lastSeenAt: ts,
      };
      sessions.set(sessionKey, session);
      return session;
    },
    async getAnonymousSession(sessionKey) {
      return sessions.get(sessionKey) ?? null;
    },
    async createProcessingJob({ sessionId, youtubeId, rawInput }) {
      const ts = now();
      const job: ProcessingJob = {
        id: id("job", ++jobCount),
        sessionId,
        youtubeId,
        input: rawInput,
        status: "queued",
        currentStep: "queued",
        createdAt: ts,
        updatedAt: ts,
      };
      jobs.set(job.id, job);
      return job;
    },
    async getProcessingJob(jobId) {
      return jobs.get(jobId) ?? null;
    },
    async getActiveJobByYoutubeId(youtubeId) {
      for (const job of jobs.values()) {
        if (job.youtubeId === youtubeId && job.status !== "failed") return job;
      }
      return null;
    },
    async updateProcessingJob(jobId, patch) {
      const existing = jobs.get(jobId);
      if (!existing) throw new Error(`Processing job not found: ${jobId}`);
      const updated = { ...existing, ...patch, updatedAt: now() };
      jobs.set(jobId, updated);
      return updated;
    },
    async saveKeyFrames(frames) {
      return frames;
    },
    async saveLesson({ youtubeId, lesson }) {
      lessons.set(youtubeId, lesson);
      return lesson;
    },
    async getLessonByYoutubeId(youtubeId) {
      return lessons.get(youtubeId) ?? null;
    },
    async saveQuizResult(input) {
      const result: QuizResult = {
        ...input,
        id: id("quiz", ++quizCount),
        completedAt: now(),
      };
      quizResults.push(result);
      return result;
    },
    async saveFeedback(input) {
      const item: Feedback = {
        ...input,
        id: id("feedback", ++feedbackCount),
        createdAt: now(),
      };
      feedback.push(item);
      return item;
    },
    async saveLead(input) {
      // Upsert by email: one row per person. A later touch refreshes the
      // mutable fields but preserves the original id + createdAt, mirroring the
      // unique-email upsert in the Supabase store.
      const existing = leads.find((lead) => lead.email === input.email);
      if (existing) {
        existing.source = input.source;
        existing.sessionId = input.sessionId;
        existing.lessonVideoId = input.lessonVideoId;
        return existing;
      }
      const item: Lead = {
        ...input,
        id: id("lead", ++leadCount),
        createdAt: now(),
      };
      leads.push(item);
      return item;
    },
  };
}

// A job that hasn't advanced in this long is treated as dead (the function that
// was processing it was killed/timed out). Generation normally finishes in well
// under a minute, so 2 minutes is a safe "give up and show an error" threshold.
const STALE_MS = 2 * 60 * 1000;
const NON_TERMINAL_STATUSES: ProcessingStatus[] = [
  "queued",
  "fetching_metadata",
  "reading_transcript",
  "generating_lesson",
];

export function isJobStale(job: ProcessingJob, nowMs = Date.now()): boolean {
  if (!NON_TERMINAL_STATUSES.includes(job.status)) return false;
  return nowMs - new Date(job.updatedAt).getTime() > STALE_MS;
}

export async function ensureAnonymousSession(
  store: MvpStore,
  sessionKey = crypto.randomUUID(),
): Promise<AnonymousSession> {
  return store.upsertAnonymousSession(sessionKey);
}

export type VideoInputValidation =
  | { ok: true; youtubeId: string }
  | { ok: false; code: MvpErrorCode; detail: string };

export function validateVideoInput(input: string): VideoInputValidation {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if ((host.endsWith("youtube.com") || host === "youtu.be") && parts[0] === "shorts") {
      return {
        ok: false,
        code: "SHORTS_UNSUPPORTED",
        detail: "YouTube Shorts are not supported for the MVP.",
      };
    }
  } catch {
    /* parseYouTubeId handles the remaining invalid cases */
  }

  const youtubeId = parseYouTubeId(trimmed);
  if (!youtubeId) {
    return {
      ok: false,
      code: "INVALID_URL",
      detail: "Paste a normal YouTube watch or share URL.",
    };
  }
  return { ok: true, youtubeId };
}

export async function startProcessingJob(
  store: MvpStore,
  input: { input: string; sessionKey?: string },
): Promise<ProcessingJob> {
  const validation = validateVideoInput(input.input);
  if (!validation.ok) {
    throw new Error(`${validation.code}:${validation.detail}`);
  }
  const session = await ensureAnonymousSession(store, input.sessionKey);
  return store.createProcessingJob({
    sessionId: session.id,
    youtubeId: validation.youtubeId,
    rawInput: input.input,
  });
}

export function assessTranscriptQuality(input: TranscriptQualityInput): TranscriptQuality {
  const cues = input.cues.filter((cue) => cue.text.trim().length > 0);
  const latestCueEnd = cues.reduce((max, cue) => Math.max(max, cue.start + cue.dur), 0);
  const coverageRatio = input.durationSeconds > 0 ? latestCueEnd / input.durationSeconds : 0;
  const cueDensity = input.durationSeconds > 0 ? cues.length / (input.durationSeconds / 60) : 0;

  if (input.language && !input.language.toLowerCase().startsWith("en")) {
    return {
      ok: false,
      code: "NON_ENGLISH",
      detail: "Only English videos are supported for the MVP.",
      coverageRatio,
      cueDensity,
    };
  }

  if (cues.length < 12 || cueDensity < 1 || coverageRatio < 0.25) {
    return {
      ok: false,
      code: "TRANSCRIPT_TOO_SPARSE",
      detail: "Transcript coverage is too sparse to build a trustworthy lesson.",
      coverageRatio,
      cueDensity,
    };
  }

  const repeated = new Map<string, number>();
  for (const cue of cues) {
    const normalized = cue.text.toLowerCase().replace(/\s+/g, " ").trim();
    repeated.set(normalized, (repeated.get(normalized) ?? 0) + 1);
  }
  const maxRepeat = Math.max(...repeated.values());
  if (maxRepeat / cues.length > 0.4) {
    return {
      ok: false,
      code: "TRANSCRIPT_TOO_NOISY",
      detail: "Transcript is too repetitive to build a trustworthy lesson.",
      coverageRatio,
      cueDensity,
    };
  }

  return { ok: true, coverageRatio, cueDensity };
}

export async function persistKeyFrames(
  store: MvpStore,
  input: {
    videoId: string;
    youtubeId: string;
    moments: KeyMoment[];
    captureAvailable: boolean;
    visualsEssential: boolean;
  },
): Promise<KeyFramePersistenceResult> {
  if (!input.captureAvailable && input.visualsEssential) {
    return {
      status: "failed",
      frames: [],
      detail: "Visual context is essential but key-frame capture is unavailable.",
    };
  }

  const moments = input.moments.slice(0, 5);
  const frames = moments.map<KeyFrame>((moment, index) => ({
    id: id("frame", index + 1),
    videoId: input.videoId,
    timestamp: moment.timestamp,
    caption: moment.caption,
    storagePath: `youtube/${input.youtubeId}/${Math.floor(moment.timestamp)}.jpg`,
    status: input.captureAvailable ? "captured" : "degraded",
  }));
  const saved = await store.saveKeyFrames(frames);
  return { status: input.captureAvailable ? "captured" : "degraded", frames: saved };
}

export async function generateAndPersistLesson(
  store: MvpStore,
  input: {
    videoId: string;
    youtubeId: string;
    input: LessonGenerationInput;
    generator: LessonGenerator;
    maxAttempts?: number;
  },
): Promise<
  | { ok: true; lesson: Lesson }
  | { ok: false; code: MvpErrorCode; detail: string }
> {
  const attempts = input.maxAttempts ?? 2;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const generated = await input.generator(input.input);
      const lesson = LessonSchema.parse(generated);
      await store.saveLesson({ youtubeId: input.youtubeId, lesson });
      return { ok: true, lesson };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError && typeof lastError === "object" && "issues" in lastError) {
    return {
      ok: false,
      code: "GENERATION_SCHEMA_INVALID",
      detail: "Generated lesson did not match the required schema.",
    };
  }
  return {
    ok: false,
    code: "GENERATION_FAILURE",
    detail: "Lesson generation failed.",
  };
}

export function recordQuizResult(
  store: MvpStore,
  input: Omit<QuizResult, "id" | "completedAt">,
): Promise<QuizResult> {
  return store.saveQuizResult(input);
}

export function recordFeedback(
  store: MvpStore,
  input: Omit<Feedback, "id" | "createdAt">,
): Promise<Feedback> {
  return store.saveFeedback(input);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function recordLead(store: MvpStore, input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  return store.saveLead({ ...input, email: normalizeEmail(input.email) });
}

export type TutorContext = {
  lesson: Lesson;
  searchable: string;
};

export function buildTutorContext(lesson: Lesson): TutorContext {
  const searchable = [
    lesson.video.title,
    lesson.reallyAbout,
    lesson.scoreReason,
    lesson.recommendation,
    lesson.bestPart.why,
    lesson.skipPart.why,
    ...lesson.cards.flatMap((card) => [card.title, card.body, card.analogy, card.quote].filter(Boolean)),
    ...lesson.tutorSeed.flatMap((seed) => [seed.q, seed.a]),
  ]
    .join(" ")
    .toLowerCase();

  return { lesson, searchable };
}

export function answerTutorQuestion(
  context: TutorContext,
  question: string,
): { supported: boolean; text: string } {
  const q = question.toLowerCase();
  if (/\b(watch|worth|full|skip|recommend)\b/.test(q)) {
    return {
      supported: true,
      text: context.lesson.recommendation,
    };
  }

  const stopWords = new Set([
    "does",
    "speaker",
    "think",
    "about",
    "video",
    "what",
    "where",
    "when",
    "would",
    "could",
    "should",
    "tell",
  ]);
  const words = q
    .split(/\W+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
  const supported = words.some((word) => context.searchable.includes(word));
  if (!supported) {
    return {
      supported: false,
      text: "I cannot tell from this video.",
    };
  }

  const seed = context.lesson.tutorSeed.find((item) =>
    words.some((word) => item.q.toLowerCase().includes(word) || item.a.toLowerCase().includes(word)),
  );
  return {
    supported: true,
    text: seed?.a ?? context.lesson.reallyAbout,
  };
}
