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
  const patched: Array<{ youtubeId: string; patch: Record<string, unknown> }> = [];
  const touched: string[] = [];
  return {
    updates,
    saved,
    patched,
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
      patchLesson: async (youtubeId: string, patch: Record<string, unknown>) => {
        patched.push({ youtubeId, patch });
      },
      getLessonByYoutubeId: async () => null,
    },
  };
}

type Scenario = {
  fetchTranscript: () => Promise<{ cues: Cue[]; languageCode: string }>;
  config: Record<string, unknown>;
  anthropicCore: (input?: Record<string, unknown>) => Promise<unknown>;
  anthropicSecondary: (input?: Record<string, unknown>) => Promise<unknown>;
  store: ReturnType<typeof makeStore>["store"];
};

let scenario: Scenario;
let bag: ReturnType<typeof makeStore>;

beforeEach(() => {
  bag = makeStore();
  scenario = {
    fetchTranscript: async () => ({ cues: denseCues(), languageCode: "en" }),
    config: {}, // no LLM keys → real templated buildLesson on the happy path
    anthropicCore: async () => {
      throw new Error("generateCore should not be called in this scenario");
    },
    anthropicSecondary: async () => ({ quiz: sampleLesson.quiz, keyMoments: sampleLesson.keyMoments }),
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
    generateCore: (input: Record<string, unknown>) => scenario.anthropicCore(input),
    generateSecondary: (input: Record<string, unknown>) => scenario.anthropicSecondary(input),
    CORE_REQUIRED_SHAPE: realAnthropic.CORE_REQUIRED_SHAPE,
    SECONDARY_REQUIRED_SHAPE: realAnthropic.SECONDARY_REQUIRED_SHAPE,
    SecondaryOutputSchema: realAnthropic.SecondaryOutputSchema,
    transcriptText: realAnthropic.transcriptText,
  }));
  mock.module("./openaiLesson.server", () => ({
    generateOpenAILesson: async () => {
      throw new Error("openai should not be called in this scenario");
    },
  }));
});

// Bun module mocks are PROCESS-GLOBAL: without this restore, whichever test
// file runs after this one imports the MOCKS instead of the real modules.
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
  test("happy path (no LLM keys) drives the job to ready and saves exactly one lesson", async () => {
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toContain("fetching_metadata");
    expect(statuses()).toContain("ready");
    expect(statuses()).not.toContain("failed");
    expect(bag.saved).toHaveLength(1);
    expect(bag.saved[0].youtubeId).toBe("abcdefghijk");
  });

  test("Anthropic path: saves partial lesson at partial_ready then patches at ready", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropicCore = async () => sampleLesson;
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toContain("partial_ready");
    expect(statuses()).toContain("ready");
    expect(bag.saved).toHaveLength(1);
    expect(bag.patched).toHaveLength(1);
    expect(bag.patched[0].youtubeId).toBe("abcdefghijk");
    expect(bag.patched[0].patch).toHaveProperty("quiz");
  });

  test("Anthropic path: core failure → GENERATION_FAILURE, no partial save", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropicCore = async () => {
      throw new Error("upstream 500");
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_FAILURE");
    expect(bag.saved).toHaveLength(0);
  });

  test("Anthropic path: secondary failure leaves lesson at partial_ready (core preserved)", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropicCore = async () => sampleLesson;
    scenario.anthropicSecondary = async () => {
      throw new Error("haiku timeout");
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(statuses()).toContain("partial_ready");
    expect(statuses()).not.toContain("ready");
    expect(bag.saved).toHaveLength(1);
    expect(bag.patched).toHaveLength(0);
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

  // NON_ENGLISH is retired: a dense Korean transcript flows through the same
  // pipeline as English and reaches ready (templated path here — no LLM keys).
  test("a non-English transcript proceeds to ready", async () => {
    scenario.fetchTranscript = async () => ({
      cues: denseCues().map((c, i) => ({ ...c, text: `한국어 자막 줄 ${i} 내용입니다` })),
      languageCode: "ko",
    });
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("ready");
    expect(bag.saved).toHaveLength(1);
  });

  test("languageCode flows into generateCore and onto the saved lesson", async () => {
    scenario.fetchTranscript = async () => ({ cues: denseCues(), languageCode: "ko" });
    scenario.config = { anthropicApiKey: "k" };
    let capturedInput: Record<string, unknown> | undefined;
    scenario.anthropicCore = async (input) => {
      capturedInput = input;
      return sampleLesson;
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(capturedInput?.languageCode).toBe("ko");
    const savedLesson = bag.saved[0].lesson as { video: { language?: string } };
    expect(savedLesson.video.language).toBe("ko");
  });

  test("an off-schema generateCore response maps to GENERATION_SCHEMA_INVALID", async () => {
    scenario.config = { anthropicApiKey: "k" };
    scenario.anthropicCore = async () => {
      throw { issues: [{ path: ["quiz"], message: "Required" }] };
    };
    const { processLesson } = await import("./processLesson.server");
    await processLesson("abcdefghijk", "job_1");

    expect(lastUpdate().status).toBe("failed");
    expect(lastUpdate().errorCode).toBe("GENERATION_SCHEMA_INVALID");
  });
});
