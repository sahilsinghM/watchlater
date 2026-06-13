import { describe, expect, test } from "bun:test";
import { Lesson as LessonSchema } from "./lessonSchema";
import { sampleLesson } from "@/data/sampleLesson";

// video.language is optional: lessons persisted before language support have
// no such field and must keep validating; new lessons round-trip the code.

describe("Lesson partial state — nullable quiz/keyMoments/tutorSeed", () => {
  test("quiz accepts null", () => {
    const partial = { ...sampleLesson, quiz: null };
    const parsed = LessonSchema.parse(partial);
    expect(parsed.quiz).toBeNull();
  });

  test("keyMoments accepts null", () => {
    const partial = { ...sampleLesson, keyMoments: null };
    const parsed = LessonSchema.parse(partial);
    expect(parsed.keyMoments).toBeNull();
  });

  test("tutorSeed accepts null", () => {
    const partial = { ...sampleLesson, tutorSeed: null };
    const parsed = LessonSchema.parse(partial);
    expect(parsed.tutorSeed).toBeNull();
  });

  test("existing fully-populated lesson still validates", () => {
    expect(() => LessonSchema.parse(sampleLesson)).not.toThrow();
  });

  test("all three null simultaneously (true partial lesson)", () => {
    const partial = { ...sampleLesson, quiz: null, keyMoments: null, tutorSeed: null };
    expect(() => LessonSchema.parse(partial)).not.toThrow();
  });

  test("quiz defaults to null when omitted", () => {
    const { quiz: _q, ...withoutQuiz } = sampleLesson as typeof sampleLesson & { quiz: unknown };
    const parsed = LessonSchema.parse(withoutQuiz);
    expect(parsed.quiz).toBeNull();
  });
});

describe("Lesson.video.language", () => {
  test("legacy lessons without video.language still validate", () => {
    expect(() => LessonSchema.parse(sampleLesson)).not.toThrow();
  });

  test("round-trips a language code on video", () => {
    const withLang = {
      ...sampleLesson,
      video: { ...sampleLesson.video, language: "ko" },
    };
    const parsed = LessonSchema.parse(withLang);
    expect(parsed.video.language).toBe("ko");
  });
});
