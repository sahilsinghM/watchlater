import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sampleLesson } from "@/data/sampleLesson";
import type { Lesson } from "./lessonSchema";
import { ensureAnonymousSession, isJobStale } from "./mvpFlow";
import { getServerConfig } from "./config.server";
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

// Returns an EXTERNAL worker target only when one is explicitly configured via
// INGEST_WORKER_URL. Otherwise returns null, which means "process inline in this
// function" (the canonical path — see requestLesson below).
//
// NOTE: this deliberately does NOT fall back to the Supabase Edge Function
// (`/functions/v1/ingest`). That function is a non-functional skeleton (see
// docs/decisions.md → Ingest Architecture). Routing to it silently swallowed
// every job on production — the job was created, the dispatch returned 200, and
// nothing ever did the transcript/LLM work — leaving the UI stuck on "fetching
// video details" forever.
export function resolveIngestTarget(config: {
  ingestWorkerUrl?: string | null;
  ingestWorkerSecret?: string | null;
}): { url: string; authHeader: string } | null {
  if (config.ingestWorkerUrl && config.ingestWorkerSecret) {
    return {
      url: `${config.ingestWorkerUrl}/ingest`,
      authHeader: config.ingestWorkerSecret,
    };
  }
  return null;
}

// Called once when the processing page mounts. Creates a job in Supabase, then
// either dispatches to an external worker (if one is configured) or processes
// the lesson inline — there is no path that creates a job nobody processes.
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

    // Create a new job and dispatch to the worker
    const session = await ensureAnonymousSession(store, "server-anonymous-session");
    const job = await store.createProcessingJob({
      sessionId: session.id,
      youtubeId,
      rawInput: `https://www.youtube.com/watch?v=${youtubeId}`,
    });

    const config = getServerConfig();
    const target = resolveIngestTarget(config);
    if (target) {
      // External worker configured (INGEST_WORKER_URL). Fire and forget — do not
      // await the body, just confirm the worker accepted the request. It then
      // processes asynchronously and writes job status + lesson to Supabase.
      fetch(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${target.authHeader}`,
        },
        body: JSON.stringify({ youtubeId, jobId: job.id }),
        signal: AbortSignal.timeout(10_000),
      }).catch((err) => console.error("[ingest] worker dispatch failed:", err));
    } else {
      // No external worker — process inline and AWAIT it. The request stays open
      // until the lesson is written (~30s), which is what keeps the Vercel
      // Function alive to do the work. The processing page polls getIngestStatus
      // in parallel, so the user sees live progress while this request runs.
      // (Fire-and-forget via waitUntil does not survive here — see processLesson.)
      await processLesson(youtubeId, job.id);
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
