import type { ProcessingJob } from "./mvpFlow";
import { assessTranscriptQuality, persistKeyFrames } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import { fetchOEmbed, fetchTranscript, IngestError } from "./transcript.server";
import { generateCore, generateSecondary } from "./anthropicLesson.server";
import { generateOpenAILesson } from "./openaiLesson.server";
import { buildLesson } from "./buildLesson";
import { detectVisualDependency } from "./visualContext";

// In-process lesson pipeline. Parallelised in two phases:
//   Phase 1: fetchOEmbed + fetchTranscript run concurrently (both need only youtubeId)
//   Phase 2: generateCore (Sonnet) + generateSecondary (Haiku) run concurrently
//
// generateCore resolves first → partial lesson saved → job set to partial_ready
// → processing page redirects user to lesson page immediately.
// generateSecondary resolves → quiz + keyMoments patched in → job set to ready.
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

function failCode(code: string): ProcessingJob["errorCode"] {
  return code as ProcessingJob["errorCode"];
}

function logIngest(event: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "ingest", ts: new Date().toISOString(), ...event }));
}

export async function processLesson(youtubeId: string, jobId: string): Promise<void> {
  const store = getMvpStore();
  const startedAt = Date.now();
  let transcriptChars = 0;
  let model = "templated";

  try {
    // Phase 1: parallel fetch — both only need youtubeId, no dependency between them.
    await store.updateProcessingJob(jobId, {
      status: "fetching_metadata",
      currentStep: "fetching_metadata",
    });
    const [meta, { cues, languageCode }] = await Promise.all([
      fetchOEmbed(youtubeId),
      fetchTranscript(youtubeId),
    ]);
    transcriptChars = cues.reduce((n, c) => n + c.text.length, 0);

    const last = cues[cues.length - 1];
    const duration = Math.max(60, Math.ceil(last.start + (last.dur || 4)));
    if (duration < MIN_DURATION)
      throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
    if (duration > MAX_DURATION)
      throw new IngestError("TOO_LONG", "Video is longer than the 12-hour maximum");

    const quality = assessTranscriptQuality({ durationSeconds: duration, cues });
    if (!quality.ok) throw new IngestError(quality.code, quality.detail);

    await store.updateProcessingJob(jobId, {
      status: "generating_lesson",
      currentStep: "generating_lesson",
    });

    const config = getServerConfig();

    // True when Anthropic fails with an out-of-credits error and openaiApiKey
    // is available — lets the request fall through to the OpenRouter path below.
    let openRouterFallback = false;

    if (config.anthropicApiKey) {
      // Phase 2: parallel generation.
      model = config.anthropicModel ?? "claude-sonnet-4-6";

      const heartbeat = setInterval(() => {
        store.touchJob(jobId).catch(() => {});
      }, HEARTBEAT_MS);

      // upsertVideo only needs meta + duration — start it in parallel with generation.
      const videoIdPromise = store.upsertVideo({
        youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title: meta.title,
        channel: meta.channel,
        thumbnailUrl: meta.thumbnail,
        durationSeconds: duration,
        language: languageCode,
      });

      const genInput = {
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel,
        meta,
        cues,
        durationSeconds: duration,
        languageCode,
      };

      // corePromise: generate → overwrite video facts → partial save → partial_ready
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

      // secondaryPromise: generate → persistKeyFrames (needs core.segments + videoId) → patch → ready
      const secondaryPromise = generateSecondary({
        apiKey: config.anthropicApiKey,
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

      const [coreResult, secondaryResult] = await Promise.allSettled([
        corePromise,
        secondaryPromise,
      ]);
      clearInterval(heartbeat);

      if (coreResult.status === "rejected") {
        const e = coreResult.reason;
        const msg = e instanceof Error ? e.message : String(e);
        if (
          config.openaiApiKey &&
          /credit balance|insufficient_credit|balance is too low/i.test(msg)
        ) {
          openRouterFallback = true;
          logIngest({
            event: "anthropic_credit_exhausted_fallback",
            jobId,
            youtubeId,
            durationMs: Date.now() - startedAt,
          });
        } else {
          const schemaInvalid = !!e && typeof e === "object" && "issues" in e;
          throw new IngestError(
            schemaInvalid ? "GENERATION_SCHEMA_INVALID" : "GENERATION_FAILURE",
            schemaInvalid
              ? "Generated lesson did not match the required schema."
              : `Lesson generation failed: ${msg}`,
          );
        }
      }

      if (secondaryResult.status === "rejected" && !openRouterFallback) {
        logIngest({
          event: "secondary_failed",
          jobId,
          youtubeId,
          error: String(secondaryResult.reason),
          durationMs: Date.now() - startedAt,
          model,
        });
        // Core lesson is already saved as partial_ready — lesson page timeout handles UI fallback.
        return;
      }

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
        // Fallback: OpenRouter — single-call path, no parallel split.
        model = config.openaiModel ?? "openrouter-default";
        const orHeartbeat = setInterval(() => {
          store.touchJob(jobId).catch(() => {});
        }, HEARTBEAT_MS);
        let lesson;
        try {
          lesson = await generateOpenAILesson({
            apiKey: config.openaiApiKey,
            model: config.openaiModel,
            meta,
            cues,
            languageCode,
          });
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
          clearInterval(orHeartbeat);
          throw new IngestError(
            schemaInvalid ? "GENERATION_SCHEMA_INVALID" : "GENERATION_FAILURE",
            detail,
          );
        }
        clearInterval(orHeartbeat);

        lesson = {
          ...lesson,
          video: {
            ...lesson.video,
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

        const { isVisuallyDependent } = detectVisualDependency(lesson.segments);
        const frameResult = await persistKeyFrames(store, {
          videoId,
          youtubeId,
          moments: lesson.keyMoments ?? [],
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
          transcriptChars,
          model,
        });
      } else {
        // No LLM key — templated density-based lesson.
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
    } // close: if (openRouterFallback || !config.anthropicApiKey)
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
  }
}
