import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { sampleLesson } from "@/data/sampleLesson";
import type { Cue } from "./buildLesson";

// generateOpenAILesson is the public boundary for the OpenRouter path.
// We pin two observable behaviors:
//   1. The model sent in the HTTP request body (default and override)
//   2. The transcript byte cap (how much of the transcript reaches the model)
//
// Both are verified by intercepting the fetch call and inspecting the request
// body — the only externally observable signal from this function short of
// actually calling OpenRouter.

const OK_RESPONSE = JSON.stringify({
  choices: [{ message: { content: JSON.stringify(sampleLesson) } }],
});

let capturedBody: Record<string, unknown> = {};
const originalFetch = globalThis.fetch;

beforeEach(() => {
  capturedBody = {};
  globalThis.fetch = mock(async (_url: string, options?: RequestInit) => {
    capturedBody = JSON.parse((options?.body as string) ?? "{}");
    return new Response(OK_RESPONSE, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  // Keep PostHog out of unit tests — we're testing HTTP request shape, not SDK integration.
  mock.module("./posthogServer.server", () => ({
    getPostHogServer: () => null,
    shutdownPostHogServer: async () => {},
  }));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const META = { youtubeId: "test123", title: "T", channel: "C", thumbnail: "u" };

function makeCues(count: number, charsEach = 60): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    start: i * 10,
    dur: 9,
    text: "x".repeat(charsEach),
  }));
}

describe("generateOpenAILesson — model selection", () => {
  test("uses meta-llama/llama-3.3-70b-instruct when no model is specified", async () => {
    const { generateOpenAILesson } = await import("./openaiLesson.server");
    await generateOpenAILesson({
      apiKey: "k",
      meta: META,
      cues: makeCues(5),
      languageCode: "en",
      youtubeId: "test123",
    });
    expect(capturedBody.model).toBe("meta-llama/llama-3.3-70b-instruct");
  });

  test("uses the caller-supplied model when one is provided", async () => {
    const { generateOpenAILesson } = await import("./openaiLesson.server");
    await generateOpenAILesson({
      apiKey: "k",
      model: "qwen/qwen-2.5-72b-instruct",
      meta: META,
      cues: makeCues(5),
      languageCode: "en",
      youtubeId: "test123",
    });
    expect(capturedBody.model).toBe("qwen/qwen-2.5-72b-instruct");
  });
});

describe("generateOpenAILesson — transcript budget", () => {
  test("sends the full transcript when cues are well under 150k chars", async () => {
    const { generateOpenAILesson } = await import("./openaiLesson.server");
    const cues = makeCues(10, 60); // ~660 chars total
    await generateOpenAILesson({
      apiKey: "k",
      meta: META,
      cues,
      languageCode: "en",
      youtubeId: "test123",
    });
    const messages = capturedBody.messages as Array<{ role: string; content: string }>;
    const userContent = JSON.parse(messages[1].content) as { transcript: string };
    expect(userContent.transcript.length).toBeGreaterThan(0);
    expect(userContent.transcript.length).toBeLessThanOrEqual(150_000);
  });

  test("caps transcript at 150,000 chars when cues exceed the budget", async () => {
    const { generateOpenAILesson } = await import("./openaiLesson.server");
    // ~4000 cues × ~67 chars each ≈ 268k chars — well over both the old 45k and new 150k limit
    const cues = makeCues(4000, 60);
    await generateOpenAILesson({
      apiKey: "k",
      meta: META,
      cues,
      languageCode: "en",
      youtubeId: "test123",
    });
    const messages = capturedBody.messages as Array<{ role: string; content: string }>;
    const userContent = JSON.parse(messages[1].content) as { transcript: string };
    expect(userContent.transcript.length).toBeLessThanOrEqual(150_000);
    // Ensure the old 45k cap is no longer in effect
    expect(userContent.transcript.length).toBeGreaterThan(45_000);
  });
});
