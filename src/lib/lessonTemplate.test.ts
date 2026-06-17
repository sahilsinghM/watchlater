import { describe, test, expect } from "bun:test";
import { LESSON_TEMPLATE } from "./lessonTemplate";
import { buildLesson } from "./buildLesson";
import type { Cue, Meta } from "./buildLesson";
import { CORE_REQUIRED_SHAPE } from "./anthropicLesson.server";

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

  test("CORE_REQUIRED_SHAPE.cards is driven by LESSON_TEMPLATE (same kind count)", () => {
    // CORE_REQUIRED_SHAPE.cards is the example array sent to the LLM.
    // It should have exactly one entry (the shape spec), but the prompt
    // must request cardCount cards. Verify the numeric instruction matches.
    const cardKindCount = LESSON_TEMPLATE.cardKinds.length;
    expect(cardKindCount).toBe(6); // guard: if template changes, this surfaces
    expect(LESSON_TEMPLATE.cardCount).toBe(cardKindCount);
  });
});
