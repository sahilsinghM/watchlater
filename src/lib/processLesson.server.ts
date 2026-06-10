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
const MAX_DURATION = 90 * 60;

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
      throw new IngestError("TOO_LONG", "Video is longer than the 90-minute maximum");

    const quality = assessTranscriptQuality({ durationSeconds: duration, language: languageCode, cues });
    if (!quality.ok) throw new IngestError(quality.code, quality.detail);

    await store.updateProcessingJob(jobId, {
      status: "generating_lesson",
      currentStep: "generating_lesson",
    });

    const config = getServerConfig();
    let lesson;
    try {
      if (config.anthropicApiKey) {
        // Preferred: Claude generation (claude-opus-4-8).
        lesson = await generateAnthropicLesson({
          apiKey: config.anthropicApiKey,
          model: config.anthropicModel,
          meta,
          cues,
        });
      } else if (config.openaiApiKey) {
        // Fallback: OpenRouter, if no Anthropic key is configured.
        lesson = await generateOpenAILesson({ apiKey: config.openaiApiKey, model: config.openaiModel, meta, cues });
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
    }

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
