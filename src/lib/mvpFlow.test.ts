import { describe, expect, test } from "bun:test";
import { sampleLesson } from "../data/sampleLesson";
import {
  answerTutorQuestion,
  assessTranscriptQuality,
  buildTutorContext,
  createMemoryMvpStore,
  ensureAnonymousSession,
  generateAndPersistLesson,
  persistKeyFrames,
  recordFeedback,
  recordQuizResult,
  startProcessingJob,
  validateVideoInput,
  type LessonGenerator,
} from "./mvpFlow";

const validUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

describe("MVP flow", () => {
  test("creates a durable anonymous processing job for a pasted URL", async () => {
    const store = createMemoryMvpStore();
    const session = await ensureAnonymousSession(store);

    const job = await startProcessingJob(store, {
      input: validUrl,
      sessionKey: session.sessionKey,
    });

    expect(job.status).toBe("queued");
    expect(job.youtubeId).toBe("dQw4w9WgXcQ");

    const reloaded = await store.getProcessingJob(job.id);
    expect(reloaded?.id).toBe(job.id);
    expect(reloaded?.sessionId).toBe(session.id);
  });

  test("classifies invalid URLs and Shorts before processing", () => {
    expect(validateVideoInput("not youtube").ok).toBe(false);
    expect(validateVideoInput("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      ok: false,
      code: "SHORTS_UNSUPPORTED",
      detail: "YouTube Shorts are not supported for the MVP.",
    });
  });

  test("rejects low-quality transcript data before generation", () => {
    const quality = assessTranscriptQuality({
      durationSeconds: 30 * 60,
      language: "en",
      cues: [
        { start: 0, dur: 2, text: "intro" },
        { start: 60, dur: 2, text: "intro" },
      ],
    });

    expect(quality.ok).toBe(false);
    expect(quality.code).toBe("TRANSCRIPT_TOO_SPARSE");
  });

  // H1: NON_ENGLISH detection — the quality function supports it, ingest must pass the real language
  test("rejects non-English transcript when actual language code is passed", () => {
    const denseCues = Array.from({ length: 30 }, (_, i) => ({
      start: i * 60,
      dur: 55,
      text: `이것은 한국어 자막입니다 번호 ${i}`,
    }));
    const quality = assessTranscriptQuality({
      durationSeconds: 30 * 60,
      language: "ko",
      cues: denseCues,
    });
    expect(quality.ok).toBe(false);
    expect(quality.code).toBe("NON_ENGLISH");
  });

  test("persists minimal key frames and records degraded visual context", async () => {
    const store = createMemoryMvpStore();
    const frames = await persistKeyFrames(store, {
      videoId: "video_1",
      youtubeId: "dQw4w9WgXcQ",
      moments: [
        { timestamp: 60, caption: "setup" },
        { timestamp: 180, caption: "core" },
        { timestamp: 300, caption: "demo" },
      ],
      captureAvailable: false,
      visualsEssential: false,
    });

    expect(frames.status).toBe("degraded");
    expect(frames.frames).toHaveLength(3);
    expect(frames.frames[0].storagePath).toContain("dQw4w9WgXcQ");
  });

  test("persists only schema-valid generated lessons", async () => {
    const store = createMemoryMvpStore();
    const generator: LessonGenerator = async () => ({
      ...sampleLesson,
      recommendation: "Watch the core section.",
    });

    const result = await generateAndPersistLesson(store, {
      videoId: "video_1",
      youtubeId: "sample",
      generator,
      input: {
        metadata: sampleLesson.video,
        transcript: [{ start: 0, dur: 10, text: "This is a useful transcript cue." }],
        keyFrames: [],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.lesson.recommendation).toBe("Watch the core section.");
    expect(await store.getLessonByYoutubeId("sample")).not.toBeNull();
  });

  test("turns invalid generation into a failure instead of placeholder content", async () => {
    const store = createMemoryMvpStore();
    const generator: LessonGenerator = async () => ({ nope: true });

    const result = await generateAndPersistLesson(store, {
      videoId: "video_1",
      youtubeId: "badbadbad01",
      generator,
      input: {
        metadata: sampleLesson.video,
        transcript: [{ start: 0, dur: 10, text: "This is a useful transcript cue." }],
        keyFrames: [],
      },
      maxAttempts: 1,
    });

    expect(result).toEqual({
      ok: false,
      code: "GENERATION_SCHEMA_INVALID",
      detail: "Generated lesson did not match the required schema.",
    });
    expect(await store.getLessonByYoutubeId("badbadbad01")).toBeNull();
  });

  test("records quiz result and usefulness feedback for the anonymous session", async () => {
    const store = createMemoryMvpStore();
    const session = await ensureAnonymousSession(store, "browser-session");

    const quiz = await recordQuizResult(store, {
      lessonId: "lesson_1",
      sessionId: session.id,
      answers: [0, 2, 1],
      score: 2,
      total: 3,
    });
    const feedback = await recordFeedback(store, {
      lessonId: "lesson_1",
      sessionId: session.id,
      useful: true,
      reason: "It showed me the core section.",
      source: "completion",
    });

    expect(quiz.score).toBe(2);
    expect(feedback.useful).toBe(true);
  });

  test("tutor answers from source context and refuses unsupported questions", () => {
    const context = buildTutorContext(sampleLesson);

    const grounded = answerTutorQuestion(context, "Should I watch the full video?");
    expect(grounded.supported).toBe(true);
    expect(grounded.text).toContain(sampleLesson.recommendation);

    const unsupported = answerTutorQuestion(context, "What does the speaker think about Mars?");
    expect(unsupported).toEqual({
      supported: false,
      text: "I cannot tell from this video.",
    });
  });
});
