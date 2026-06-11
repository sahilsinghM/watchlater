import { describe, expect, test } from "bun:test";
import { fmtTime, fmtRange } from "./lessonSchema";

// Clock format pinned to exactly what the YouTube player shows. This is the
// bug class the owner caught on 2026-06-11 ("~2346" / "517:26") — table-driven
// so every boundary stays pinned.

describe("fmtTime — YouTube-style clock", () => {
  const cases: Array<[number, string]> = [
    [0, "0:00"],
    [7, "0:07"],
    [59, "0:59"],
    [60, "1:00"],
    [746, "12:26"], // the owner's example
    [599, "9:59"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"], // hour boundary
    [3661, "1:01:01"],
    [31046, "8:37:26"], // the 8.6h Lex episode — previously "517:26"
    [12 * 3600, "12:00:00"],
  ];
  for (const [seconds, expected] of cases) {
    test(`${seconds}s renders as ${expected}`, () => {
      expect(fmtTime(seconds)).toBe(expected);
    });
  }

  test("fractional seconds floor instead of rounding up", () => {
    expect(fmtTime(89.9)).toBe("1:29");
  });

  test("negative input clamps to 0:00 instead of producing nonsense", () => {
    expect(fmtTime(-5)).toBe("0:00");
  });

  test("fmtRange joins two clock times with an en dash", () => {
    expect(fmtRange(82, 1400)).toBe("1:22–23:20");
  });
});
