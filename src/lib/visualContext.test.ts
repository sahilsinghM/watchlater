import { describe, expect, test } from "bun:test";
import { detectVisualDependency } from "./visualContext";
import type { Segment } from "./lessonSchema";

function seg(kind: Segment["kind"], start: number, end: number): Segment {
  return { kind, start, end, title: "test", blurb: "test segment" };
}

describe("detectVisualDependency", () => {
  test("video with no demo segments is not visually dependent", () => {
    const segments: Segment[] = [
      seg("watch", 0, 120),
      seg("core", 120, 360),
      seg("skip", 360, 600),
    ];
    const result = detectVisualDependency(segments);
    expect(result.isVisuallyDependent).toBe(false);
    expect(result.demoPct).toBe(0);
  });

  test("video with >30% demo time is visually dependent", () => {
    const segments: Segment[] = [
      seg("watch", 0, 60),
      seg("demo", 60, 300), // 240s demo out of 480s total = 50%
      seg("core", 300, 480),
    ];
    const result = detectVisualDependency(segments);
    expect(result.isVisuallyDependent).toBe(true);
    expect(result.demoPct).toBeGreaterThan(30);
  });

  test("video that is entirely demo segments has high confidence", () => {
    const segments: Segment[] = [seg("demo", 0, 300), seg("demo", 300, 600)];
    const result = detectVisualDependency(segments);
    expect(result.isVisuallyDependent).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.demoPct).toBeCloseTo(100);
  });

  test("video at exactly 30% demo is NOT visually dependent (boundary exclusive)", () => {
    const segments: Segment[] = [
      seg("demo", 0, 30),
      seg("watch", 30, 100), // 30/100 = 30% demo exactly
    ];
    const result = detectVisualDependency(segments);
    expect(result.isVisuallyDependent).toBe(false);
  });

  test("empty segments array returns not visually dependent", () => {
    const result = detectVisualDependency([]);
    expect(result.isVisuallyDependent).toBe(false);
    expect(result.demoPct).toBe(0);
  });
});
