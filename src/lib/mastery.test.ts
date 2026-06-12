import { describe, expect, test } from "bun:test";
import { masteryResult } from "./mastery";

// The celebration screen's math, pure: quiz score -> percentage + tier.
// Tiers drive the copy and the dial color; pinned here so the screen itself
// stays logic-free.

describe("masteryResult", () => {
  test("a perfect score is Mastered at 100%", () => {
    expect(masteryResult(3, 3)).toEqual({ pct: 100, label: "Mastered", tier: "high" });
  });

  test("two of three is a Solid grasp", () => {
    expect(masteryResult(2, 3)).toEqual({ pct: 67, label: "Solid grasp", tier: "mid" });
  });

  test("zero is Worth a re-read at 0%", () => {
    expect(masteryResult(0, 3)).toEqual({ pct: 0, label: "Worth a re-read", tier: "low" });
  });

  test("the 80% boundary is Mastered", () => {
    expect(masteryResult(4, 5)).toEqual({ pct: 80, label: "Mastered", tier: "high" });
  });

  test("the 50% boundary is Solid grasp", () => {
    expect(masteryResult(1, 2)).toEqual({ pct: 50, label: "Solid grasp", tier: "mid" });
  });

  test("a zero total can't divide-by-zero", () => {
    expect(masteryResult(0, 0).pct).toBe(0);
  });

  test("49% is Worth a re-read — one below the mid boundary", () => {
    expect(masteryResult(49, 100)).toEqual({ pct: 49, label: "Worth a re-read", tier: "low" });
  });
});
