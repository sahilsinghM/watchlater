import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchTranscript, fetchOEmbed, IngestError } from "./transcript.server";

// The transcript client talks to two external services (YouTube oEmbed for
// metadata, Supadata for captions). These tests pin its OBSERVABLE behaviour —
// the cues it returns and the error codes it reports — by stubbing the
// network at the `fetch` boundary. They never assert on how it calls Supadata.

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

// Helper for fetchOEmbed (still throws IngestError)
async function oEmbedCodeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR_THROWN";
  } catch (e) {
    expect(e).toBeInstanceOf(IngestError);
    return (e as IngestError).code;
  }
}

beforeEach(() => {
  process.env.SUPADATA_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
});

describe("fetchTranscript (Supadata)", () => {
  test("maps a synchronous segment response onto cues in seconds, dropping empty text", async () => {
    stubFetch(() => ({
      body: {
        lang: "en",
        content: [
          { text: "hello there", offset: 1000, duration: 2000, lang: "en" },
          { text: "   ", offset: 3000, duration: 1000, lang: "en" }, // empty → dropped
          { text: "next line", offset: 4000, duration: 2500, lang: "en" },
        ],
      },
    }));

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.languageCode).toBe("en");
    expect(result.cues).toEqual([
      { start: 1, dur: 2, text: "hello there" },
      { start: 4, dur: 2.5, text: "next line" },
    ]);
  });

  test("returns NO_CAPTIONS when the transcript content is empty", async () => {
    stubFetch(() => ({ body: { lang: "en", content: [] } }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NO_CAPTIONS");
  });

  test("returns UNKNOWN when SUPADATA_API_KEY is not set", async () => {
    delete process.env.SUPADATA_API_KEY;
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("UNKNOWN");
  });

  test("maps a 404 to NOT_FOUND", async () => {
    stubFetch(() => ({ status: 404, body: {} }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NOT_FOUND");
  });

  test("maps a 401/403 auth failure to UNKNOWN", async () => {
    stubFetch(() => ({ status: 403, body: {} }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("UNKNOWN");
  });

  test("polls the async job on a 202 and returns cues once it completes", async () => {
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
    if (!result.ok) throw new Error("expected ok");
    expect(result.cues).toEqual([{ start: 0, dur: 5, text: "from job" }]);
  });

  test("maps a failed async job to NO_CAPTIONS", async () => {
    globalThis.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    stubFetch((url) => {
      if (url.includes("/transcript/job-err")) {
        return { body: { status: "failed", error: "no captions on source" } };
      }
      return { status: 202, body: { jobId: "job-err" } };
    });

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NO_CAPTIONS");
  });

  test("maps a 206 (Supadata transcript-unavailable) to NO_CAPTIONS", async () => {
    stubFetch(() => ({
      status: 206,
      body: {
        error: "transcript-unavailable",
        message: "Transcript Unavailable",
        details: "No transcript is available for this video.",
      },
    }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NO_CAPTIONS");
  });

  test("returns UNKNOWN when a 200 body fails schema validation", async () => {
    stubFetch(() => ({
      body: { unexpected_field: "some value" },
    }));
    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("UNKNOWN");
  });

  test("returns UNKNOWN when the async job poll response has an unexpected schema", async () => {
    globalThis.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    stubFetch((url) => {
      if (url.includes("/transcript/job-bad-schema")) {
        return { body: { status: "unknown_status_value" } };
      }
      return { status: 202, body: { jobId: "job-bad-schema" } };
    });

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("UNKNOWN");
  });

  test("returns NO_CAPTIONS when the async job completes but all segments are whitespace-only", async () => {
    globalThis.setTimeout = ((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    stubFetch((url) => {
      if (url.includes("/transcript/job-whitespace")) {
        return {
          body: {
            status: "completed",
            content: [
              { text: "   ", offset: 0, duration: 2000, lang: "en" },
              { text: "\t", offset: 2000, duration: 1000, lang: "en" },
            ],
          },
        };
      }
      return { status: 202, body: { jobId: "job-whitespace" } };
    });

    const result = await fetchTranscript("abcdefghijk");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("NO_CAPTIONS");
  });
});

describe("fetchOEmbed (metadata)", () => {
  test("maps oEmbed fields onto Meta", async () => {
    stubFetch(() => ({
      body: {
        title: "A Real Talk",
        author_name: "Some Channel",
        thumbnail_url: "https://i.ytimg.com/x.jpg",
      },
    }));

    const meta = await fetchOEmbed("abcdefghijk");
    expect(meta).toEqual({
      youtubeId: "abcdefghijk",
      title: "A Real Talk",
      channel: "Some Channel",
      thumbnail: "https://i.ytimg.com/x.jpg",
    });
  });

  test("maps a 404 to NOT_FOUND", async () => {
    stubFetch(() => ({ status: 404, body: {} }));
    expect(await oEmbedCodeOf(() => fetchOEmbed("abcdefghijk"))).toBe("NOT_FOUND");
  });
});
