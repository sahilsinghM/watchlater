import type { ProcessingJob } from "./mvpFlow";
import { assessTranscriptQuality } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import { fetchOEmbed, fetchTranscript, IngestError } from "./transcript.server";
import { generateAnthropicLesson } from "./anthropicLesson.server";
import { generateOpenAILesson } from "./openaiLesson.server";
import { buildLesson } from "./buildLesson";

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

export async function processLesson(youtubeId: string, jobId: string): Promise<void> {
  const store = getMvpStore();
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

    const last = cues[cues.length - 1];
    const duration = Math.max(60, Math.ceil(last.start + (last.dur || 4)));
    if (duration < MIN_DURATION)
      throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
    if (duration > MAX_DURATION)
      throw new IngestError("TOO_LONG", "Video is longer than the 12-hour maximum");

    const quality = assessTranscriptQuality({
      durationSeconds: duration,
      language: languageCode,
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
        lesson = await generateAnthropicLesson({
          apiKey: config.anthropicApiKey,
          model: config.anthropicModel,
          meta,
          cues,
          durationSeconds: duration,
        });
      } else if (config.openaiApiKey) {
        // Fallback: OpenRouter, if no Anthropic key is configured.
        lesson = await generateOpenAILesson({
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
          meta,
          cues,
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
      },
    };

    await store.saveLesson({ youtubeId, lesson });
    await store.updateProcessingJob(jobId, { status: "ready", currentStep: "ready" });
    console.log(`[ingest] done: ${youtubeId}`);
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
    console.error(`[ingest] failed ${youtubeId}: [${code}] ${detail}`);
  }
}
