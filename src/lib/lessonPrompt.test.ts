import { describe, expect, test } from "bun:test";
import { languageDirective } from "./lessonPrompt";

// The directive is the single source of truth both generators append to their
// prompts. It must (1) name the transcript's language code, (2) cover the
// prose fields the lesson schema exposes to users, and (3) pin JSON field
// names and enum values to the exact English strings — a translated enum
// value fails LessonSchema.parse and kills the job as GENERATION_SCHEMA_INVALID.

describe("languageDirective", () => {
  test("names the transcript language code", () => {
    expect(languageDirective("ko")).toContain('"ko"');
    expect(languageDirective("hi")).toContain('"hi"');
  });

  test("covers the user-facing prose fields", () => {
    const d = languageDirective("ko");
    for (const field of ["tutorSeed", "scoreReason", "reallyAbout", "recommendation", "quiz"]) {
      expect(d).toContain(field);
    }
  });

  test("pins enum values and field names to English", () => {
    const d = languageDirective("ko");
    for (const enumField of ["difficulty", "watchVerdict", "kind", "visualContextStatus"]) {
      expect(d).toContain(enumField);
    }
    expect(d).toMatch(/EXACTLY/);
  });

  test("English is not special-cased — same directive shape", () => {
    expect(languageDirective("en")).toContain('"en"');
    expect(languageDirective("en")).toMatch(/LANGUAGE RULE/);
  });
});
