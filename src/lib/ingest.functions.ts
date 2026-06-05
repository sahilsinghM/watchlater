import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sampleLesson } from "@/data/sampleLesson";
import type { Lesson } from "./lessonSchema";
import { ensureAnonymousSession } from "./mvpFlow";
import { getServerConfig } from "./config.server";
import { getMvpStore } from "./mvpRuntime.server";

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

// Called once when the processing page mounts. Creates a job in Supabase,
// then fires the ingest worker (Railway) without waiting for it to finish.
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

    // Return immediately if a job is already running / queued
    const existing = await store.getActiveJobByYoutubeId(youtubeId);
    if (existing && existing.status !== "failed") {
      return { jobId: existing.id, alreadyReady: false };
    }

    // Create a new job and dispatch to the worker
    const session = await ensureAnonymousSession(store, "server-anonymous-session");
    const job = await store.createProcessingJob({
      sessionId: session.id,
      youtubeId,
      rawInput: `https://www.youtube.com/watch?v=${youtubeId}`,
    });

    const config = getServerConfig();
    if (config.ingestWorkerUrl && config.ingestWorkerSecret) {
      // Fire and forget — do not await the body, just confirm the worker
      // accepted the request. The worker processes asynchronously and writes
      // job status + lesson directly to Supabase.
      fetch(`${config.ingestWorkerUrl}/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ingest-secret": config.ingestWorkerSecret,
        },
        body: JSON.stringify({ youtubeId, jobId: job.id }),
        signal: AbortSignal.timeout(10_000),
      }).catch((err) => console.error("[ingest] worker dispatch failed:", err));
    } else {
      console.warn("[ingest] INGEST_WORKER_URL not set — job created but no worker dispatched");
    }

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

    const job = await store.getActiveJobByYoutubeId(youtubeId);
    if (!job) return { phase: "idle" };

    if (job.status === "ready") return { phase: "ready" };

    if (job.status === "failed") {
      return {
        phase: "failed",
        code: (job.errorCode as IngestErrorCode) ?? "UNKNOWN",
        detail: job.errorDetail ?? "Ingest failed",
      };
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
