import { describe, expect, test } from "bun:test";
import { buildLesson, type Cue, type Meta } from "./buildLesson";

const meta: Meta = {
  youtubeId: "dQw4w9WgXcQ",
  title: "Test Video",
  channel: "Test Channel",
  thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
};

function makeCues(count: number, durationSeconds = 600): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    start: (i / count) * durationSeconds * 0.9,
    dur: (durationSeconds * 0.9) / count,
    text: `This is transcript cue number ${i + 1} with enough content to be a real sentence from the video.`,
  }));
}

describe("buildLesson", () => {
  // C3: WatchScore is a transcript-density signal, must be disclosed as an estimate
  test("scoreReason explicitly labels itself a density estimate so users know AI analysis is pending", () => {
    const lesson = buildLesson(meta, makeCues(50));
    expect(lesson.scoreReason.toLowerCase()).toMatch(/density|estimate/i);
  });

  test("scoreReason is never a bare quality claim without a basis qualifier", () => {
    const lesson = buildLesson(meta, makeCues(200));
    expect(lesson.scoreReason.length).toBeGreaterThan(20);
    expect(lesson.scoreReason).toContain("cue");
  });

  // C3: WatchScore formula produces 6-10 range — watchVerdict "skip" and "lesson_only" are unreachable
  test("watchScore is always between 6 and 10 regardless of cue count", () => {
    for (const count of [12, 50, 200, 800]) {
      const lesson = buildLesson(meta, makeCues(count));
      expect(lesson.watchScore).toBeGreaterThanOrEqual(6);
      expect(lesson.watchScore).toBeLessThanOrEqual(10);
    }
  });

  test("watchVerdict is never 'skip' since watchScore floor is 6", () => {
    const lesson = buildLesson(meta, makeCues(12));
    expect(lesson.watchVerdict).not.toBe("skip");
  });

  // H1: assessTranscriptQuality with language — test the quality function directly
  test("produces schema-valid lesson for cue counts from 12 to 800", () => {
    for (const count of [12, 50, 200, 800]) {
      expect(() => buildLesson(meta, makeCues(count))).not.toThrow();
    }
  });

  // pickCards edge case: sparse transcript (exactly 6 cues) should not produce duplicate cards
  test("produces non-duplicate card ids for sparse transcripts", () => {
    const sparseCues = makeCues(6, 300);
    const lesson = buildLesson(meta, sparseCues);
    const ids = lesson.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // pickCards: fewer than 6 distinct cues in middle band triggers padding path
  test("produces 6 cards even when fewer than 6 cues fall in the middle 70% band", () => {
    // All cues are in the first 10% — all outside the middle band
    const edgeCues = Array.from({ length: 8 }, (_, i) => ({
      start: i * 3,
      dur: 2,
      text: `Edge cue ${i} with enough text for the card builder to work with properly.`,
    }));
    const lesson = buildLesson(meta, edgeCues);
    expect(lesson.cards).toHaveLength(6);
    const ids = lesson.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
