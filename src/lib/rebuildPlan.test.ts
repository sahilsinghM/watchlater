import { describe, expect, test } from "bun:test";
import { estimateRebuildCost, formatRebuildReport, type RebuildOutcome } from "./rebuildPlan";

// Pure helpers for the rebuild script: cost estimate printed before the operator
// confirms, and a per-video outcome table printed at the end.

describe("estimateRebuildCost", () => {
  test("zero lessons costs nothing", () => {
    const estimate = estimateRebuildCost(0);
    expect(estimate.lessons).toBe(0);
    expect(estimate.lowUsd).toBe(0);
    expect(estimate.highUsd).toBe(0);
  });

  test("1 lesson gives a plausible range in cents (not free, not absurd)", () => {
    const estimate = estimateRebuildCost(1);
    expect(estimate.lessons).toBe(1);
    expect(estimate.lowUsd).toBeGreaterThan(0);
    expect(estimate.highUsd).toBeGreaterThan(estimate.lowUsd);
    expect(estimate.highUsd).toBeLessThan(1); // < $1 for a single lesson
  });

  test("10 lessons scales linearly", () => {
    const one = estimateRebuildCost(1);
    const ten = estimateRebuildCost(10);
    expect(ten.lowUsd).toBeCloseTo(one.lowUsd * 10, 5);
    expect(ten.highUsd).toBeCloseTo(one.highUsd * 10, 5);
  });
});

describe("formatRebuildReport", () => {
  const outcomes: RebuildOutcome[] = [
    { youtubeId: "aaaa", title: "Video A", ok: true, durationMs: 12000 },
    { youtubeId: "bbbb", title: "Video B", ok: false, error: "TRANSCRIPT_NOT_FOUND" },
    { youtubeId: "cccc", title: "Video C", ok: true, durationMs: 9500 },
  ];

  test("report contains all video ids", () => {
    const report = formatRebuildReport(outcomes);
    expect(report).toContain("aaaa");
    expect(report).toContain("bbbb");
    expect(report).toContain("cccc");
  });

  test("report shows pass/fail counts", () => {
    const report = formatRebuildReport(outcomes);
    expect(report).toContain("2"); // 2 successes
    expect(report).toContain("1"); // 1 failure
  });

  test("report shows error for failed videos", () => {
    const report = formatRebuildReport(outcomes);
    expect(report).toContain("TRANSCRIPT_NOT_FOUND");
  });

  test("empty outcomes produces a report without crashing", () => {
    const report = formatRebuildReport([]);
    expect(report).toBeTruthy();
    expect(report).toContain("0");
  });
});
