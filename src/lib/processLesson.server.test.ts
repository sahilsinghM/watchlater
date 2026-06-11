import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import * as transcriptNs from "./transcript.server";
import * as configNs from "./config.server";
import * as runtimeNs from "./mvpRuntime.server";
import * as anthropicNs from "./anthropicLesson.server";
import * as openaiNs from "./openaiLesson.server";

// ESM namespace objects are LIVE views — after mock.module they reflect the
// mock, so restoring "from the namespace" restores nothing. Snapshot the real
// exports into plain objects at load time, before any mock registers.
const realTranscript = { ...transcriptNs };
const realConfig = { ...configNs };
const realRuntime = { ...runtimeNs };
const realAnthropic = { ...anthropicNs };
const realOpenAI = { ...openaiNs };
import { IngestError } from "./transcript.server";
import type { Cue } from "./buildLesson";

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
  const saved: Array<{ youtubeId: string }> = [];
  return {
    updates,
    saved,
    store: {
      updateProcessingJob: async (_id: string, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
      saveLesson: async (x: { youtubeId: string }) => {
        saved.push(x);
      },
    },
  };
}

type Scenario = {
  fetchTranscript: () => Promise<{ cues: Cue[]; languageCode: string }>;
  config: Record<string, unknown>;
  anthropic: () => Promise<unknown>;
  store: ReturnType<typeof makeStore>["store"];
};

let scenario: Scenario;
let bag: ReturnType<typeof makeStore>;

beforeEach(() => {
  bag = makeStore();
  scenario = {
    fetchTranscript: async () => ({ cues: denseCues(), languageCode: "en" }),
    config: {}, // no LLM keys → real templated buildLesson on the happy path
    anthropic: async () => {
      throw new Error("anthropic should not be called in this scenario");
    },
    store: bag.store,
  };

  // Late-bound mocks: the closures read `scenario`, so each test mutates
  // scenario before invoking processLesson.
  mock.module("./transcript.server", () => ({
    IngestError,
    fetchOEmbed: async () => META,
    fetchTranscript: () => scenario.fetchTranscript(),
  }));
  mock.module("./config.server", () => ({ getServerConfig: () => scenario.config }));
  mock.module("./mvpRuntime.server", () => ({ getMvpStore: () => scenario.store }));
  mock.module("./anthropicLesson.server", () => ({
    generateAnthropicLesson: () => scenario.anthropic(),
  }));
  mock.module("./openaiLesson.server", () => ({
    generateOpenAILesson: async () => {
      throw new Error("openai should not be called in this scenario");
    },
  }));
});

// Bun module mocks are PROCESS-GLOBAL: without this restore, whichever test
// file runs after this one imports the MOCKS instead of the real modules.
// That broke transcript.server.test.ts in CI (different file order than local)
// — its stubbed 404s "succeeded" because fetchTranscript was scenario data.
afterAll(() => {
  mock.module("./transcript.server", () => realTranscript);
  mock.module("./config.server", () => realConfig);
  mock.module("./mvpRuntime.server", () => realRuntime);
  mock.module("./anthropicLesson.server", () => realAnthropic);
  mock.module("./openaiLesson.server", () => realOpenAI);
});

const statuses = () => bag.updates.map((u) => u.status);
const lastUpdate = () => bag.updates[bag.updates.length - 1];

describe("processLesson", () => {
  test("happy path drives the job to ready and saves exactly one lesson", async () => {
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toEqual([
      "fetching_metadata",
      "reading_transcript",
      "generating_lesson",
      "ready",
    ]);
    expect(bag.saved).toHaveLength(1);
    expect(bag.saved[0].youtubeId).toBe("abcdefghijk");
  });

  test("a too-short video fails with TOO_SHORT and saves no lesson", async () => {
    scenario.fetchTranscript = async () => ({ cues: shortCues(), languageCode: "en" });
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("TOO_SHORT");
    expect(bag.saved).toHaveLength(0);
  });

  test("a transcript error propagates its IngestError code (NO_CAPTIONS)", async () => {
    scenario.fetchTranscript = async () => {
      throw new IngestError("NO_CAPTIONS", "This video has no captions");
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("NO_CAPTIONS");
  });

  test("a generation transport error maps to GENERATION_FAILURE", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropic = async () => {
      throw new Error("upstream 500");
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_FAILURE");
    expect(bag.saved).toHaveLength(0);
  });

  test("an off-schema generation (zod issues) maps to GENERATION_SCHEMA_INVALID", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropic = async () => {
      throw { issues: [{ path: ["quiz"], message: "Required" }] };
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_SCHEMA_INVALID");
  });
});
