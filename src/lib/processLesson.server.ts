import type { ProcessingJob } from "./mvpFlow";
import { assessTranscriptQuality, persistKeyFrames } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import { fetchOEmbed, fetchTranscript, IngestError } from "./transcript.server";
import type { Meta } from "./buildLesson";
import { generateOpenAILesson } from "./openaiLesson.server";
import { buildLesson } from "./buildLesson";
import type { Cue } from "./buildLesson";
import { detectVisualDependency } from "./visualContext";
import { shutdownPostHogServer } from "./posthogServer.server";

// In-process lesson pipeline.
//   Phase 1: fetchOEmbed + fetchTranscript run concurrently
//   Phase 2: generateOpenAILesson (OpenRouter) → save → ready
//            Falls back to buildLesson when no API key is configured.
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

    if (config.openaiApiKey) {
      model = config.openaiModel ?? "openrouter-default";

      let lesson: Record<string, unknown>;
      try {
        lesson = (await withHeartbeat(store, jobId, () =>
          generateOpenAILesson({
            apiKey: config.openaiApiKey!,
            model: config.openaiModel,
            meta,
            cues,
            languageCode,
            youtubeId,
          }),
        )) as Record<string, unknown>;
      } catch (e: unknown) {
        // 402 = OpenRouter credits exhausted. Degrade to the template lesson so
        // customers still get something rather than a hard failure. The loud
        // console.error surfaces in Vercel logs / PostHog for alerting.
        const creditsExhausted =
          !!e && typeof e === "object" && "status" in e && (e as { status: unknown }).status === 402;
        if (creditsExhausted) {
          console.error(
            "[ingest] OpenRouter credits exhausted — falling back to template lesson. Top up at openrouter.ai/credits",
          );
          const fallback = buildLesson(meta, cues);
          await store.saveLesson({ youtubeId, lesson: fallback });
          await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
          model = "templated-credits-exhausted";
          logIngest({
            event: "done",
            jobId,
            youtubeId,
            outcome: "ready",
            durationMs: Date.now() - startedAt,
            transcriptChars,
            model,
          });
          return { ok: true };
        }

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
    } else {
      // No API key configured — use the template-based fallback (dev / demo environments).
      const lesson = buildLesson(meta, cues);
      await store.saveLesson({ youtubeId, lesson });
      await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
    }

    logIngest({
      event: "done",
      jobId,
      youtubeId,
      outcome: "ready",
      durationMs: Date.now() - startedAt,
      transcriptChars,
      model,
    });
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
  } finally {
    await shutdownPostHogServer();
  }
}
