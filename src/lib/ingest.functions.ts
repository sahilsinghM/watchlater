import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sampleLesson } from "@/data/sampleLesson";
import type { Lesson } from "./lessonSchema";
import { ensureAnonymousSession, isJobStale } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { processLesson } from "./processLesson.server";

export type IngestErrorCode =
  | "NO_CAPTIONS"
  | "PRIVATE_OR_BLOCKED"
  | "NOT_FOUND"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NON_ENGLISH"
  | "TRANSCRIPT_TOO_SPARSE"
  | "TRANSCRIPT_TOO_NOISY"
  | "GENERATION_FAILURE"
  | "GENERATION_SCHEMA_INVALID"
  | "TIMEOUT"
  | "UNKNOWN";

export type IngestPhase = "idle" | "processing" | "ready" | "failed";

export type IngestStatus =
  | { phase: "idle" }
  | { phase: "processing"; step: string }
  | { phase: "ready" }
  | { phase: "failed"; code: IngestErrorCode; detail: string };

const youtubeIdValidator = z
  .string()
  .refine((s) => s === "sample" || /^[A-Za-z0-9_-]{11}$/.test(s), "invalid youtube id");

// Called once when the processing page mounts. Creates a job in Supabase, then
// processes the lesson inline in this function — there is no path that creates
// a job nobody processes. Inline is the ONLY pipeline: the external
// ingest-worker dispatch and the Supabase Edge Function skeleton were removed
// (2026-06-11) after inline proved out to the 12-hour cap (8h44m built in 97s).
// See docs/decisions.md → Ingest Architecture.
export const requestLesson = createServerFn({ method: "POST" })
  .inputValidator((input: { youtubeId: string }) =>
    z.object({ youtubeId: youtubeIdValidator }).parse(input),
  )
  .handler(async ({ data }) => {
    const { youtubeId } = data;
    if (youtubeId === "sample") return { jobId: "sample", alreadyReady: true };

    const store = getMvpStore();

    // Return immediately if lesson is already cached
    const cached = await store.getLessonByYoutubeId(youtubeId);
    if (cached) return { jobId: null, alreadyReady: true };

    // Reuse an in-flight job, but only if it's actually still being processed.
    // A non-failed job that has gone stale was abandoned (its processing request
    // died) — fall through and reprocess it rather than handing back a job that
    // will never advance.
    const existing = await store.getLatestJobByYoutubeId(youtubeId);
    if (existing && existing.status !== "failed" && !isJobStale(existing)) {
      return { jobId: existing.id, alreadyReady: false };
    }

    // Create a new job and process it inline, AWAITED. The request stays open
    // until the lesson is written, which is what keeps the Vercel Function
    // alive to do the work. The processing page polls getIngestStatus in
    // parallel, so the user sees live progress while this request runs.
    // (Fire-and-forget via waitUntil does not survive here — see processLesson.)
    const session = await ensureAnonymousSession(store, "server-anonymous-session");
    const job = await store.createProcessingJob({
      sessionId: session.id,
      youtubeId,
      rawInput: `https://www.youtube.com/watch?v=${youtubeId}`,
    });
    await processLesson(youtubeId, job.id);

    return { jobId: job.id, alreadyReady: false };
  });

// Polled every 2 s by the processing page. Checks Supabase for current status.
export const getIngestStatus = createServerFn({ method: "GET" })
  .inputValidator((input: { youtubeId: string }) =>
    z.object({ youtubeId: youtubeIdValidator }).parse(input),
  )
  .handler(async ({ data }): Promise<IngestStatus> => {
    const { youtubeId } = data;
    if (youtubeId === "sample") return { phase: "ready" };

    const store = getMvpStore();

    const cached = await store.getLessonByYoutubeId(youtubeId);
    if (cached) return { phase: "ready" };

    const job = await store.getLatestJobByYoutubeId(youtubeId);
    if (!job) return { phase: "idle" };

    if (job.status === "ready") return { phase: "ready" };

    if (job.status === "failed") {
      return {
        phase: "failed",
        code: (job.errorCode as IngestErrorCode) ?? "UNKNOWN",
        detail: job.errorDetail ?? "Ingest failed",
      };
    }

    if (isJobStale(job)) {
      return { phase: "failed", code: "TIMEOUT", detail: "Job timed out" };
    }

    return { phase: "processing", step: job.currentStep };
  });

// Pure cache read — used by the lesson page once status is "ready".
export const getLessonByYoutubeId = createServerFn({ method: "POST" })
  .inputValidator((input: { youtubeId: string }) =>
    z.object({ youtubeId: youtubeIdValidator }).parse(input),
  )
  .handler(async ({ data }): Promise<Lesson> => {
    const { youtubeId } = data;
    if (youtubeId === "sample") return sampleLesson;

    const store = getMvpStore();
    const lesson = await store.getLessonByYoutubeId(youtubeId);
    if (!lesson) throw new Error("INGEST:UNKNOWN:Lesson not found — ingest may still be running");
    return lesson;
  });

export function parseIngestError(message: string): { code: IngestErrorCode; detail: string } {
  const m = /^INGEST:([A-Z_]+):(.*)$/.exec(message);
  if (!m) return { code: "UNKNOWN", detail: message };
  return { code: m[1] as IngestErrorCode, detail: m[2] };
}
