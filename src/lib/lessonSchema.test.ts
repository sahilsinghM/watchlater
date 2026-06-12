import { describe, expect, test } from "bun:test";
import { Lesson as LessonSchema } from "./lessonSchema";
import { sampleLesson } from "@/data/sampleLesson";

// video.language is optional: lessons persisted before language support have
// no such field and must keep validating; new lessons round-trip the code.

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
