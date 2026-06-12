import { describe, expect, test } from "bun:test";
import { buildOgCard } from "./ogCard";

describe("buildOgCard", () => {
  test("a lesson becomes a card with title, channel and a /10 score", () => {
    const card = buildOgCard({
      title: "How CPUs actually execute instructions",
      channel: "Core Dumped",
      watchScore: 7.5,
    });
    expect(card).toEqual({
      title: "How CPUs actually execute instructions",
      channel: "Core Dumped",
      scoreText: "7.5 / 10",
      isFallback: false,
    });
  });

  test("a long title is truncated on a word boundary with an ellipsis", () => {
    const longTitle =
      "The complete and unabridged history of every single microprocessor architecture ever shipped between 1971 and the present day";
    const card = buildOgCard({ title: longTitle, channel: "Chips", watchScore: 5 });
    expect(card.title.endsWith("…")).toBe(true);
    expect(card.title.length).toBeLessThanOrEqual(81);
  });

  test("null input returns the generic brand fallback", () => {
    const card = buildOgCard(null);
    expect(card.isFallback).toBe(true);
    expect(card.title).toBe("Learn any YouTube video in 5 minutes.");
    expect(card.channel).toBeNull();
    expect(card.scoreText).toBeNull();
  });

  test("integer score renders with one decimal place", () => {
    const card = buildOgCard({ title: "Test", channel: "Ch", watchScore: 8 });
    expect(card.scoreText).toBe("8.0 / 10");
  });
});
