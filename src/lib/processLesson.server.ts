import type { ProcessingJob } from "./mvpFlow";
import { assessTranscriptQuality, persistKeyFrames } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import { fetchOEmbed, fetchTranscript, IngestError } from "./transcript.server";
import { generateAnthropicLesson } from "./anthropicLesson.server";
import { generateOpenAILesson } from "./openaiLesson.server";
import { buildLesson } from "./buildLesson";
import { detectVisualDependency } from "./visualContext";

// In-process lesson pipeline. This is the canonical ingest path now that
// Supadata removes the datacenter-IP blocking that previously forced this work
// onto a separate residential-proxy worker. It writes straight to the shared
// MvpStore. See docs/decisions.md → Ingest Architecture.
//
// IMPORTANT: this MUST be awaited by the request that triggers it (see
// requestLesson in ingest.functions.ts). Fire-and-forget via `waitUntil` does
// NOT survive in the TanStack Start / Nitro serverFn environment on Vercel — the
// function freezes after returning and the background promise is dropped, which
// left jobs stuck at "fetching video details" forever.

const MIN_DURATION = 5 * 60;
// 12h covers even marathon podcasts (Lex Fridman #438 is 8h44m). The cost and
// latency of long videos are bounded by the transcript char budget in
// anthropicLesson.server.ts, not by this cap.
const MAX_DURATION = 12 * 60 * 60;

// While Claude generates, the job row isn't otherwise touched. isJobStale's
// window is 2 minutes, and long-video generation can exceed that — without a
// heartbeat the UI would misreport an in-flight build as TIMEOUT and a retry
// would spawn a duplicate job. Keep updated_at fresh while we work.
const HEARTBEAT_MS = 45_000;

// We persist the worker-style error codes (NO_CAPTIONS, TOO_SHORT, …) because
// the processing page's ERROR_COPY is keyed by IngestErrorCode. The store types
// errorCode as MvpErrorCode, so a cast is needed for the codes that only live in
// the ingest vocabulary.
function failCode(code: string): ProcessingJob["errorCode"] {
  return code as ProcessingJob["errorCode"];
}

// Single-line JSON lifecycle events, filterable in Vercel log search with
// `"tag":"ingest"`. The ops report (scripts/job-stats.ts) reads the jobs
// table; these logs are the per-job drill-down.
function logIngest(event: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "ingest", ts: new Date().toISOString(), ...event }));
}

export async function processLesson(youtubeId: string, jobId: string): Promise<void> {
  const store = getMvpStore();
  const startedAt = Date.now();
  let transcriptChars = 0;
  let model = "templated";
  try {
    await store.updateProcessingJob(jobId, {
      status: "fetching_metadata",
      currentStep: "fetching_metadata",
    });
    const meta = await fetchOEmbed(youtubeId);

    await store.updateProcessingJob(jobId, {
      status: "reading_transcript",
      currentStep: "reading_transcript",
    });
    const { cues, languageCode } = await fetchTranscript(youtubeId);
    transcriptChars = cues.reduce((n, c) => n + c.text.length, 0);

    const last = cues[cues.length - 1];
    const duration = Math.max(60, Math.ceil(last.start + (last.dur || 4)));
    if (duration < MIN_DURATION)
      throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
    if (duration > MAX_DURATION)
      throw new IngestError("TOO_LONG", "Video is longer than the 12-hour maximum");

    const quality = assessTranscriptQuality({
      durationSeconds: duration,
      cues,
    });
    if (!quality.ok) throw new IngestError(quality.code, quality.detail);

    await store.updateProcessingJob(jobId, {
      status: "generating_lesson",
      currentStep: "generating_lesson",
    });

    const config = getServerConfig();
    let lesson;
    const heartbeat = setInterval(() => {
      store
        .updateProcessingJob(jobId, {
          status: "generating_lesson",
          currentStep: "generating_lesson",
        })
        .catch(() => {});
    }, HEARTBEAT_MS);
    try {
      if (config.anthropicApiKey) {
        // Preferred: Claude generation.
        model = config.anthropicModel ?? "claude-sonnet-4-6";
        lesson = await generateAnthropicLesson({
          apiKey: config.anthropicApiKey,
          model: config.anthropicModel,
          meta,
          cues,
          durationSeconds: duration,
          languageCode,
        });
      } else if (config.openaiApiKey) {
        // Fallback: OpenRouter, if no Anthropic key is configured.
        model = config.openaiModel ?? "openrouter-default";
        lesson = await generateOpenAILesson({
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
          meta,
          cues,
          languageCode,
        });
      } else {
        // No LLM key at all — templated, density-based lesson (no AI).
        lesson = buildLesson(meta, cues);
      }
    } catch (e: unknown) {
      // A zod failure means the model returned an off-schema lesson; anything
      // else is a generation/transport failure. Both map to UI error copy.
      const schemaInvalid = !!e && typeof e === "object" && "issues" in e;
      throw new IngestError(
        schemaInvalid ? "GENERATION_SCHEMA_INVALID" : "GENERATION_FAILURE",
        schemaInvalid
          ? "Generated lesson did not match the required schema."
          : `Lesson generation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearInterval(heartbeat);
    }

    // The video facts are ours, not the model's. Left to the model, duration
    // gets reported as far as the transcript it saw (a 63-min video once
    // shipped as "50.5 min" because of excerpt truncation) and titles/urls can
    // drift. Overwrite with the values we fetched and computed.
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

    // Upsert a videos row so key-frame screenshots have a valid FK target.
    const videoId = await store.upsertVideo({
      youtubeId,
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      title: meta.title,
      channel: meta.channel,
      thumbnailUrl: meta.thumbnail,
      durationSeconds: duration,
      language: languageCode,
    });

    // Capture is not available server-side (no headless browser). Whether the
    // lesson degrades gracefully or is marked low-confidence depends on whether
    // the video is visually dependent.
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
