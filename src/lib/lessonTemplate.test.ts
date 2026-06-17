import { describe, test, expect } from "bun:test";
import { LESSON_TEMPLATE } from "./lessonTemplate";
import { buildLesson } from "./buildLesson";
import type { Cue, Meta } from "./buildLesson";

const meta: Meta = {
  youtubeId: "dQw4w9WgXcQ",
  title: "Test Video",
  channel: "Test Channel",
  thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
};

function makeCues(count: number): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    start: (i / count) * 540,
    dur: 540 / count,
    text: `Cue ${i + 1}: real sentence content for the lesson builder to process.`,
  }));
}

describe("LESSON_TEMPLATE", () => {
  test("cardKinds.length matches cardCount", () => {
    expect(LESSON_TEMPLATE.cardKinds.length).toBe(LESSON_TEMPLATE.cardCount);
  });

  test("buildLesson produces exactly cardCount cards", () => {
    const lesson = buildLesson(meta, makeCues(50));
    expect(lesson.cards.length).toBe(LESSON_TEMPLATE.cardCount);
  });

  test("buildLesson segment count matches LESSON_TEMPLATE.segmentCount", () => {
    const lesson = buildLesson(meta, makeCues(50));
    expect(lesson.segments.length).toBe(LESSON_TEMPLATE.segmentCount);
  });

  test("cardCount is 6", () => {
    expect(LESSON_TEMPLATE.cardCount).toBe(6);
    expect(LESSON_TEMPLATE.cardKinds.length).toBe(6);
  });
});
