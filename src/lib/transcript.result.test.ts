/**
 * Tests for the typed-result interface of fetchTranscript.
 * fetchTranscript returns TranscriptResult instead of throwing IngestError —
 * callers switch on result.ok instead of try/catching.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchTranscript } from "./transcript.server";

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;

type Handler = (url: string) => { status?: number; body: unknown };

function stubFetch(handler: Handler) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const { status = 200, body } = handler(url);
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  process.env.SUPADATA_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
});

describe("fetchTranscript — typed result interface", () => {
  test("returns ok:true with cues on a sync success", async () => {
    stubFetch(() => ({
      body: {
        lang: "en",
        content: [
          { text: "hello there", offset: 1000, duration: 2000, lang: "en" },
          { text: "next line", offset: 4000, duration: 2500, lang: "en" },
        ],
      },
    }));

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.languageCode).toBe("en");
      expect(result.cues.length).toBe(2);
    }
  });

  test("returns ok:false with code NO_CAPTIONS when content is empty", async () => {
    stubFetch(() => ({ body: { lang: "en", content: [] } }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_CAPTIONS");
    }
  });

  test("returns ok:false with code NOT_FOUND on a 404", async () => {
    stubFetch(() => ({ status: 404, body: {} }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  test("returns ok:false with code UNKNOWN when API key is missing", async () => {
    delete process.env.SUPADATA_API_KEY;
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNKNOWN");
  });

  test("returns ok:false with code NO_CAPTIONS on a 206 (unavailable)", async () => {
    stubFetch(() => ({
      status: 206,
      body: { error: "transcript-unavailable", message: "Transcript Unavailable" },
    }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_CAPTIONS");
  });

  test("returns ok:true after polling an async 202 job", async () => {
    globalThis.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    let polls = 0;
    stubFetch((url) => {
      if (url.includes("/transcript/job-123")) {
        polls += 1;
        if (polls < 2) return { body: { status: "active" } };
        return {
          body: {
            status: "completed",
            content: [{ text: "from job", offset: 0, duration: 5000, lang: "en" }],
          },
        };
      }
      return { status: 202, body: { jobId: "job-123" } };
    });

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cues).toEqual([{ start: 0, dur: 5, text: "from job" }]);
  });
});
