import { describe, expect, test } from "bun:test";
import { languageLabel } from "./language";

// Human-readable language names for the lesson hero eyebrow ("… · KOREAN").
// The eyebrow's CSS uppercases the text, so the label is plain English case.

describe("languageLabel", () => {
  test("maps ISO codes to English language names", () => {
    expect(languageLabel("ko")).toBe("Korean");
    expect(languageLabel("hi")).toBe("Hindi");
    expect(languageLabel("es")).toBe("Spanish");
  });

  test("handles region-qualified codes", () => {
    expect(languageLabel("pt-BR")).toBe("Brazilian Portuguese");
  });

  test("falls back to the raw code uppercased when unknown", () => {
    expect(languageLabel("zz-fake")).toBe("ZZ-FAKE");
    expect(languageLabel("")).toBe("");
  });
});
