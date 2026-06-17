import { describe, test, expect } from "bun:test";
import { buildTutorKnowledge, answerQuestion } from "./tutorKnowledge";
import type { TutorKnowledge } from "./tutorKnowledge";

// Minimal knowledge fixture — tests need only this, not a full Lesson object.
const base: TutorKnowledge = {
  summary: "A talk about how neural networks learn from data.",
  keyPoints: [
    "Gradient descent minimises loss by following slope downhill",
    "Backpropagation computes gradients layer by layer",
    "Learning rate controls the size of each update step",
  ],
  qaBank: [
    { q: "What is gradient descent?", a: "An optimisation algorithm that adjusts weights by following the gradient of the loss function." },
    { q: "Who is the speaker?", a: "Andrej Karpathy, a researcher who helped build GPT-4." },
  ],
  recommendation: "Skip the first 5 minutes of intro; the core argument starts at 6:00.",
};

describe("answerQuestion", () => {
  test("returns the recommendation for a watch/skip question", () => {
    const result = answerQuestion(base, "Is this worth watching?");
    expect(result).toBe(base.recommendation);
  });

  test("returns the recommendation for a 'should I skip' question", () => {
    const result = answerQuestion(base, "Should I skip any part?");
    expect(result).toBe(base.recommendation);
  });

  test("returns a matching qaBank answer when the question overlaps keywords", () => {
    const result = answerQuestion(base, "What does gradient descent do?");
    expect(result).toContain("optimisation");
  });

  test("returns the summary when no qaBank entry matches", () => {
    const result = answerQuestion(base, "What is backpropagation exactly?");
    // "backpropagation" appears in keyPoints but not qaBank q/a → falls back to summary
    expect(result).toBe(base.summary);
  });

  test("returns canned refusal for a question with no qualifying keywords (empty-keyword edge case)", () => {
    const result = answerQuestion(base, "What?");
    expect(result).toBe("I cannot tell from this video.");
  });

  test("returns canned refusal for a one-word stop-word-only question", () => {
    const result = answerQuestion(base, "When?");
    expect(result).toBe("I cannot tell from this video.");
  });
});

describe("buildTutorKnowledge", () => {
  test("maps lesson tutorSeed into qaBank", async () => {
    const { sampleLesson } = await import("@/data/sampleLesson");
    const knowledge = buildTutorKnowledge(sampleLesson);
    expect(knowledge.qaBank).toEqual(sampleLesson.tutorSeed);
  });

  test("maps lesson reallyAbout into summary", async () => {
    const { sampleLesson } = await import("@/data/sampleLesson");
    const knowledge = buildTutorKnowledge(sampleLesson);
    expect(knowledge.summary).toBe(sampleLesson.reallyAbout);
  });

  test("maps card titles into keyPoints", async () => {
    const { sampleLesson } = await import("@/data/sampleLesson");
    const knowledge = buildTutorKnowledge(sampleLesson);
    expect(knowledge.keyPoints).toEqual(sampleLesson.cards.map((c) => c.title));
  });
});
