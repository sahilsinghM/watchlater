import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import * as transcriptNs from "./transcript.server";
import * as configNs from "./config.server";
import * as runtimeNs from "./mvpRuntime.server";
import * as openaiNs from "./openaiLesson.server";

// ESM namespace objects are LIVE views — after mock.module they reflect the
// mock, so restoring "from the namespace" restores nothing. Snapshot the real
// exports into plain objects at load time, before any mock registers.
const realTranscript = { ...transcriptNs };
const realConfig = { ...configNs };
const realRuntime = { ...runtimeNs };
const realOpenAI = { ...openaiNs };
import { IngestError } from "./transcript.server";
import type { Cue } from "./buildLesson";
import { sampleLesson } from "@/data/sampleLesson";

// processLesson is the inline ingest orchestrator. Its observable contract is
// the sequence of job-status transitions it drives and the errorCode it
// persists on failure — which is exactly what the processing page's ERROR_COPY
// keys off. We pin that contract by mocking the deep modules at their
// boundaries (transcript fetch, LLM generation, store) and asserting the
// patches written to a fake store.

const META = { youtubeId: "abcdefghijk", title: "T", channel: "C", thumbnail: "u" };

// 40 cues across ~30 min — dense, English, non-repetitive — so the duration
// and quality gates pass and we reach generation on the happy path.
function denseCues(): Cue[] {
  return Array.from({ length: 40 }, (_, i) => ({
    start: i * 45,
    dur: 40,
    text: `Point number ${i} about the subject matter discussed here.`,
  }));
}

// 12 cues ending at ~2 min — under the 5-minute minimum.
function shortCues(): Cue[] {
  return Array.from({ length: 12 }, (_, i) => ({ start: i * 10, dur: 9, text: `line ${i}` }));
}

function makeStore() {
  const updates: Array<Record<string, unknown>> = [];
  const saved: Array<{ youtubeId: string; lesson?: Record<string, unknown> }> = [];
  const touched: string[] = [];
  return {
    updates,
    saved,
    touched,
    store: {
      updateProcessingJob: async (_id: string, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
      touchJob: async (jobId: string) => {
        touched.push(jobId);
      },
      upsertVideo: async () => "video_test_id",
      saveKeyFrames: async (frames: unknown[]) => frames,
      saveLesson: async (x: { youtubeId: string; lesson?: Record<string, unknown> }) => {
        saved.push(x);
      },
      getLessonByYoutubeId: async () => null,
    },
  };
}

type Scenario = {
  fetchTranscript: () => Promise<
    { ok: true; cues: Cue[]; languageCode: string } | { ok: false; code: string; detail: string }
  >;
  config: Record<string, unknown>;
  openaiLesson: (input?: Record<string, unknown>) => Promise<unknown>;
  store: ReturnType<typeof makeStore>["store"];
};

let scenario: Scenario;
let bag: ReturnType<typeof makeStore>;

beforeEach(() => {
  bag = makeStore();
  scenario = {
    fetchTranscript: async () => ({ ok: true as const, cues: denseCues(), languageCode: "en" }),
    config: {}, // no LLM keys → real templated buildLesson on the happy path
    openaiLesson: async () => {
      throw new Error("generateOpenAILesson should not be called in this scenario");
    },
    store: bag.store,
  };

  mock.module("./transcript.server", () => ({
    IngestError,
    fetchOEmbed: async () => META,
    fetchTranscript: () => scenario.fetchTranscript(),
  }));
  mock.module("./config.server", () => ({ getServerConfig: () => scenario.config }));
  mock.module("./mvpRuntime.server", () => ({ getMvpStore: () => scenario.store }));
  mock.module("./openaiLesson.server", () => ({
    generateOpenAILesson: (input: Record<string, unknown>) => scenario.openaiLesson(input),
  }));
  mock.module("./posthogServer.server", () => ({
    getPostHogServer: () => null,
    shutdownPostHogServer: async () => {},
  }));
});

afterAll(() => {
  mock.module("./transcript.server", () => realTranscript);
  mock.module("./config.server", () => realConfig);
  mock.module("./mvpRuntime.server", () => realRuntime);
  mock.module("./openaiLesson.server", () => realOpenAI);
  mock.module("./posthogServer.server", () => ({
    getPostHogServer: () => null,
    shutdownPostHogServer: async () => {},
  }));
});

const statuses = () => bag.updates.map((u) => u.status);
const lastUpdate = () => bag.updates[bag.updates.length - 1];

describe("processLesson", () => {
  test("returns { ok: true } on the happy path", async () => {
    const { processLesson } = await import("./processLesson.server");
    const result = await processLesson("abcdefghijk", "job_1");
    expect(result.ok).toBe(true);
  });

  test("returns { ok: false, code } when transcript fetch fails", async () => {
    scenario.fetchTranscript = async () => ({
      ok: false as const,
      code: "NO_CAPTIONS",
      detail: "no captions",
    });
    const { processLesson } = await import("./processLesson.server");
    const result = await processLesson("abcdefghijk", "job_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_CAPTIONS");
  });

  test("returns { ok: false, code: TOO_SHORT } for a too-short video", async () => {
    scenario.fetchTranscript = async () => ({
      ok: true as const,
      cues: shortCues(),
      languageCode: "en",
    });
    const { processLesson } = await import("./processLesson.server");
    const result = await processLesson("abcdefghijk", "job_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TOO_SHORT");
  });

  test("happy path (no LLM keys) drives the job to ready and saves exactly one lesson", async () => {
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toContain("fetching_metadata");
    expect(statuses()).toContain("ready");
    expect(statuses()).not.toContain("failed");
    expect(bag.saved).toHaveLength(1);
    expect(bag.saved[0].youtubeId).toBe("abcdefghijk");
  });

  test("OpenRouter path: saves lesson at ready on success", async () => {
    scenario.config = { openaiApiKey: "k" };
    scenario.openaiLesson = async () => sampleLesson;
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toContain("ready");
    expect(statuses()).not.toContain("failed");
    expect(bag.saved).toHaveLength(1);
    expect(bag.saved[0].youtubeId).toBe("abcdefghijk");
  });

  test("OpenRouter path: generation failure → GENERATION_FAILURE, no lesson saved", async () => {
    scenario.config = { openaiApiKey: "k" };
    scenario.openaiLesson = async () => {
      throw new Error("upstream 500");
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_FAILURE");
    expect(bag.saved).toHaveLength(0);
  });

  test("OpenRouter path: off-schema response maps to GENERATION_SCHEMA_INVALID", async () => {
    scenario.config = { openaiApiKey: "k" };
    scenario.openaiLesson = async () => {
      throw { issues: [{ path: ["quiz"], message: "Required" }] };
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_SCHEMA_INVALID");
  });

  test("a too-short video fails with TOO_SHORT and saves no lesson", async () => {
    scenario.fetchTranscript = async () => ({
      ok: true as const,
      cues: shortCues(),
      languageCode: "en",
    });
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("TOO_SHORT");
    expect(bag.saved).toHaveLength(0);
  });

  test("a transcript error propagates its IngestError code (NO_CAPTIONS)", async () => {
    scenario.fetchTranscript = async () => ({
      ok: false as const,
      code: "NO_CAPTIONS",
      detail: "This video has no captions",
    });
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("NO_CAPTIONS");
  });

  test("a non-English transcript proceeds to ready", async () => {
    scenario.fetchTranscript = async () => ({
      ok: true as const,
      cues: denseCues().map((c, i) => ({ ...c, text: `한국어 자막 줄 ${i} 내용입니다` })),
      languageCode: "ko",
    });
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("ready");
    expect(bag.saved).toHaveLength(1);
  });

  test("languageCode flows into generateOpenAILesson and onto the saved lesson", async () => {
    scenario.fetchTranscript = async () => ({
      ok: true as const,
      cues: denseCues(),
      languageCode: "ko",
    });
    scenario.config = { openaiApiKey: "k" };
    let capturedInput: Record<string, unknown> | undefined;
    scenario.openaiLesson = async (input) => {
      capturedInput = input;
      return sampleLesson;
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(capturedInput?.languageCode).toBe("ko");
    const savedLesson = bag.saved[0].lesson as { video: { language?: string } };
    expect(savedLesson.video.language).toBe("ko");
  });
});
