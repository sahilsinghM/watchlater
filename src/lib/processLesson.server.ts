import type { ProcessingJob } from "./mvpFlow";
import { assessTranscriptQuality, persistKeyFrames } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import { fetchOEmbed, fetchTranscript, IngestError } from "./transcript.server";
import type { Meta } from "./buildLesson";
import { generateCore, generateSecondary } from "./anthropicLesson.server";
import { generateOpenAILesson } from "./openaiLesson.server";
import { buildLesson } from "./buildLesson";
import type { Cue } from "./buildLesson";
import { detectVisualDependency } from "./visualContext";

// In-process lesson pipeline. Parallelised in two phases:
//   Phase 1 (fetchAndValidate): fetchOEmbed + fetchTranscript run concurrently
//   Phase 2a (runAnthropicCore): generateCore → partial save → partial_ready
//   Phase 2b (runAnthropicSecondary): generateSecondary → patch → ready
//
// IMPORTANT: this MUST be awaited by the request that triggers it (see
// requestLesson in ingest.functions.ts). Fire-and-forget via `waitUntil` does
// NOT survive in the TanStack Start / Nitro serverFn environment on Vercel.

const MIN_DURATION = 5 * 60;
const MAX_DURATION = 12 * 60 * 60;

// Heartbeat keeps updated_at fresh so isJobStale's 2-minute window doesn't
// fire during long-video generation. Uses touchJob (not updateProcessingJob)
// so it doesn't overwrite partial_ready back to generating_lesson.
const HEARTBEAT_MS = 45_000;

export type IngestResult = { ok: true } | { ok: false; code: string; detail: string };

function failCode(code: string): ProcessingJob["errorCode"] {
  return code as ProcessingJob["errorCode"];
}

function logIngest(event: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "ingest", ts: new Date().toISOString(), ...event }));
}

// ─── Phase helpers ───────────────────────────────────────────────────────────

type MetadataPhaseResult = {
  meta: Meta;
  cues: Cue[];
  languageCode: string;
  duration: number;
};

// Phase 1: fetch + validate. Runs fetchOEmbed and fetchTranscript in parallel,
// then checks duration and transcript quality gates.
async function fetchAndValidate(youtubeId: string): Promise<MetadataPhaseResult> {
  const [meta, transcriptResult] = await Promise.all([
    fetchOEmbed(youtubeId),
    fetchTranscript(youtubeId),
  ]);
  if (!transcriptResult.ok) throw new IngestError(transcriptResult.code, transcriptResult.detail);
  const { cues, languageCode } = transcriptResult;

  const last = cues[cues.length - 1];
  const duration = Math.max(60, Math.ceil(last.start + (last.dur || 4)));
  if (duration < MIN_DURATION)
    throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
  if (duration > MAX_DURATION)
    throw new IngestError("TOO_LONG", "Video is longer than the 12-hour maximum");

  const quality = assessTranscriptQuality({ durationSeconds: duration, cues });
  if (!quality.ok) throw new IngestError(quality.code, quality.detail);

  return { meta, cues, languageCode, duration };
}

// Heartbeat helper: fires touchJob every HEARTBEAT_MS while fn() runs, then
// clears the interval regardless of outcome.
async function withHeartbeat<T>(
  store: ReturnType<typeof getMvpStore>,
  jobId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const interval = setInterval(() => {
    store.touchJob(jobId).catch(() => {});
  }, HEARTBEAT_MS);
  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}

type AnthropicPhaseInput = {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  duration: number;
  languageCode: string;
  youtubeId: string;
  jobId: string;
  startedAt: number;
};

type AnthropicCoreResult = {
  lesson: Record<string, unknown>;
  openRouterFallback: boolean;
};

// Phase 2a: run generateCore in parallel with generateSecondary (Anthropic path).
// Returns the assembled lesson after saving it at partial_ready.
async function runAnthropicCore(
  store: ReturnType<typeof getMvpStore>,
  input: AnthropicPhaseInput,
): Promise<AnthropicCoreResult> {
  const { apiKey, model, meta, cues, duration, languageCode, youtubeId, jobId, startedAt } = input;

  const videoIdPromise = store.upsertVideo({
    youtubeId,
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    title: meta.title,
    channel: meta.channel,
    thumbnailUrl: meta.thumbnail,
    durationSeconds: duration,
    language: languageCode,
  });

  const genInput = { apiKey, model, meta, cues, durationSeconds: duration, languageCode };
  const config = getServerConfig();

  const corePromise = generateCore(genInput).then(async (core) => {
    const lesson = {
      ...core,
      video: {
        ...core.video,
        youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title: meta.title,
        channel: meta.channel,
        thumbnail: meta.thumbnail,
        duration,
        language: languageCode,
      },
    };
    await store.saveLesson({ youtubeId, lesson });
    await store.updateProcessingJob(jobId, {
      status: "partial_ready",
      currentStep: "partial_ready",
    });
    logIngest({ event: "partial_ready", jobId, youtubeId, durationMs: Date.now() - startedAt });
    return lesson;
  });

  const secondaryPromise = generateSecondary({
    apiKey,
    meta,
    cues,
    durationSeconds: duration,
    languageCode,
  }).then(async ({ quiz, keyMoments }) => {
    const [coreLesson, videoId] = await Promise.all([corePromise, videoIdPromise]);
    const { isVisuallyDependent } = detectVisualDependency(coreLesson.segments);
    const frameResult = await persistKeyFrames(store, {
      videoId,
      youtubeId,
      moments: keyMoments,
      captureAvailable: false,
      visualsEssential: isVisuallyDependent,
    });
    const visualContextStatus: "captured" | "degraded" | "unavailable" =
      frameResult.status === "failed" ? "unavailable" : frameResult.status;
    await store.patchLesson(youtubeId, { quiz, keyMoments, visualContextStatus });
    await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
  });

  const [coreResult, secondaryResult] = await Promise.allSettled([corePromise, secondaryPromise]);

  if (coreResult.status === "rejected") {
    const e = coreResult.reason;
    const msg = e instanceof Error ? e.message : String(e);
    if (config.openaiApiKey && /credit balance|insufficient_credit|balance is too low/i.test(msg)) {
      logIngest({
        event: "anthropic_credit_exhausted_fallback",
        jobId,
        youtubeId,
        durationMs: Date.now() - startedAt,
      });
      return { lesson: {}, openRouterFallback: true };
    }
    const schemaInvalid = !!e && typeof e === "object" && "issues" in e;
    throw new IngestError(
      schemaInvalid ? "GENERATION_SCHEMA_INVALID" : "GENERATION_FAILURE",
      schemaInvalid
        ? "Generated lesson did not match the required schema."
        : `Lesson generation failed: ${msg}`,
    );
  }

  if (secondaryResult.status === "rejected") {
    logIngest({
      event: "secondary_failed",
      jobId,
      youtubeId,
      error: String(secondaryResult.reason),
      durationMs: Date.now() - startedAt,
      model: model ?? "claude-sonnet-4-6",
    });
    return { lesson: coreResult.value as Record<string, unknown>, openRouterFallback: false };
  }

  return { lesson: coreResult.value as Record<string, unknown>, openRouterFallback: false };
}

type OpenAIPhaseInput = {
  apiKey: string;
  model?: string;
  meta: Meta;
  cues: Cue[];
  duration: number;
  languageCode: string;
  youtubeId: string;
  jobId: string;
  startedAt: number;
};

// Phase 2b: single-call OpenAI/OpenRouter path — no parallel split.
async function runOpenAIPhase(
  store: ReturnType<typeof getMvpStore>,
  input: OpenAIPhaseInput,
): Promise<void> {
  const { apiKey, model, meta, cues, duration, languageCode, youtubeId, jobId, startedAt } = input;

  let lesson: Record<string, unknown>;
  try {
    lesson = (await generateOpenAILesson({ apiKey, model, meta, cues, languageCode })) as Record<
      string,
      unknown
    >;
  } catch (e: unknown) {
    const schemaInvalid = !!e && typeof e === "object" && "issues" in e;
    let detail: string;
    if (schemaInvalid) {
      const zErr = e as { issues: Array<{ path: (string | number)[]; message: string }> };
      const paths = zErr.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      detail = `Schema invalid — ${paths}`;
    } else {
      detail = `Lesson generation failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    throw new IngestError(
      schemaInvalid ? "GENERATION_SCHEMA_INVALID" : "GENERATION_FAILURE",
      detail,
    );
  }

  lesson = {
    ...lesson,
    video: {
      ...(lesson.video as Record<string, unknown>),
      youtubeId,
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      title: meta.title,
      channel: meta.channel,
      thumbnail: meta.thumbnail,
      duration,
      language: languageCode,
    },
  };

  const videoId = await store.upsertVideo({
    youtubeId,
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    title: meta.title,
    channel: meta.channel,
    thumbnailUrl: meta.thumbnail,
    durationSeconds: duration,
    language: languageCode,
  });

  const { isVisuallyDependent } = detectVisualDependency(lesson.segments as never[]);
  const frameResult = await persistKeyFrames(store, {
    videoId,
    youtubeId,
    moments: (lesson.keyMoments as never[]) ?? [],
    captureAvailable: false,
    visualsEssential: isVisuallyDependent,
  });
  const visualContextStatus: "captured" | "degraded" | "unavailable" =
    frameResult.status === "failed" ? "unavailable" : frameResult.status;
  lesson = { ...lesson, visualContextStatus };

  await store.saveLesson({ youtubeId, lesson });
  await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
  logIngest({
    event: "done",
    jobId,
    youtubeId,
    outcome: "ready",
    durationMs: Date.now() - startedAt,
    transcriptChars: (cues as Cue[]).reduce((n, c) => n + c.text.length, 0),
    model: model ?? "openrouter-default",
  });
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function processLesson(youtubeId: string, jobId: string): Promise<IngestResult> {
  const store = getMvpStore();
  const startedAt = Date.now();
  let transcriptChars = 0;
  let model = "templated";

  try {
    await store.updateProcessingJob(jobId, {
      status: "fetching_metadata",
      currentStep: "fetching_metadata",
    });

    const { meta, cues, languageCode, duration } = await fetchAndValidate(youtubeId);
    transcriptChars = cues.reduce((n, c) => n + c.text.length, 0);

    await store.updateProcessingJob(jobId, {
      status: "generating_lesson",
      currentStep: "generating_lesson",
    });

    const config = getServerConfig();
    let openRouterFallback = false;

    if (config.anthropicApiKey) {
      model = config.anthropicModel ?? "claude-sonnet-4-6";
      const result = await withHeartbeat(store, jobId, () =>
        runAnthropicCore(store, {
          apiKey: config.anthropicApiKey!,
          model: config.anthropicModel,
          meta,
          cues,
          duration,
          languageCode,
          youtubeId,
          jobId,
          startedAt,
        }),
      );
      openRouterFallback = result.openRouterFallback;

      if (!openRouterFallback) {
        logIngest({
          event: "done",
          jobId,
          youtubeId,
          outcome: "ready",
          durationMs: Date.now() - startedAt,
          transcriptChars,
          model,
        });
      }
    }

    if (openRouterFallback || !config.anthropicApiKey) {
      if (config.openaiApiKey) {
        model = config.openaiModel ?? "openrouter-default";
        await withHeartbeat(store, jobId, () =>
          runOpenAIPhase(store, {
            apiKey: config.openaiApiKey!,
            model: config.openaiModel,
            meta,
            cues,
            duration,
            languageCode,
            youtubeId,
            jobId,
            startedAt,
          }),
        );
      } else {
        const lesson = buildLesson(meta, cues);
        await store.saveLesson({ youtubeId, lesson });
        await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
        logIngest({
          event: "done",
          jobId,
          youtubeId,
          outcome: "ready",
          durationMs: Date.now() - startedAt,
          transcriptChars,
          model,
        });
      }
    }

    return { ok: true };
  } catch (e: unknown) {
    const code = e instanceof IngestError ? e.code : "UNKNOWN";
    const detail = e instanceof Error ? e.message : "Ingest failed";
    await store
      .updateProcessingJob(jobId, {
        status: "failed",
        currentStep: "failed",
        errorCode: failCode(code),
        errorDetail: detail,
      })
      .catch(() => {});
    logIngest({
      event: "failed",
      jobId,
      youtubeId,
      outcome: "failed",
      errorCode: code,
      errorDetail: detail,
      durationMs: Date.now() - startedAt,
      transcriptChars,
      model,
    });
    return { ok: false, code, detail };
  }
}
