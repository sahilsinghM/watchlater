import { describe, expect, test } from "bun:test";
import {
  CORE_REQUIRED_SHAPE,
  SECONDARY_REQUIRED_SHAPE,
  SecondaryOutputSchema,
} from "./anthropicLesson.server";
import { sampleLesson } from "@/data/sampleLesson";

// Prompt shape tests — verify that each generation call's requiredShape
// contains exactly the right fields. These prevent the common failure mode of
// the model being asked for fields it can't produce (or not asked for fields
// the schema requires), which surfaces as GENERATION_SCHEMA_INVALID at runtime.

describe("CORE_REQUIRED_SHAPE", () => {
  test("contains core lesson fields", () => {
    const keys = Object.keys(CORE_REQUIRED_SHAPE);
    expect(keys).toContain("segments");
    expect(keys).toContain("cards");
    expect(keys).toContain("watchScore");
    expect(keys).toContain("watchVerdict");
    expect(keys).toContain("difficulty");
  });

  test("does not contain quiz, keyMoments, or tutorSeed", () => {
    const shape = JSON.stringify(CORE_REQUIRED_SHAPE);
    expect(shape).not.toContain("quiz");
    expect(shape).not.toContain("keyMoments");
    expect(shape).not.toContain("tutorSeed");
  });
});

describe("SECONDARY_REQUIRED_SHAPE", () => {
  test("contains quiz and keyMoments", () => {
    const keys = Object.keys(SECONDARY_REQUIRED_SHAPE);
    expect(keys).toContain("quiz");
    expect(keys).toContain("keyMoments");
  });

  test("does not contain core lesson fields", () => {
    const shape = JSON.stringify(SECONDARY_REQUIRED_SHAPE);
    expect(shape).not.toContain("segments");
    expect(shape).not.toContain("cards");
    expect(shape).not.toContain("watchScore");
    expect(shape).not.toContain("tutorSeed");
  });
});

describe("SecondaryOutputSchema", () => {
  test("accepts valid quiz + keyMoments", () => {
    const valid = {
      quiz: sampleLesson.quiz,
      keyMoments: sampleLesson.keyMoments,
    };
    expect(() => SecondaryOutputSchema.parse(valid)).not.toThrow();
  });

  test("rejects output missing quiz", () => {
    expect(() => SecondaryOutputSchema.parse({ keyMoments: [] })).toThrow();
  });

  test("rejects output missing keyMoments", () => {
    expect(() => SecondaryOutputSchema.parse({ quiz: [] })).toThrow();
  });

  test("rejects output with invalid quiz item shape", () => {
    const bad = {
      quiz: [{ id: "q1", prompt: "Q?" }], // missing correctIndex, options, explanation
      keyMoments: [],
    };
    expect(() => SecondaryOutputSchema.parse(bad)).toThrow();
  });
});
