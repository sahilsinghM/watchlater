/**
 * Contract tests for the Supadata API adapter.
 *
 * These tests document and enforce the contract between WatchLater and the
 * Supadata transcript API. They run against fixture data that mirrors real
 * observed responses (captured via scripts/probe-supadata.ts).
 *
 * If a test here fails after a dependency update, the API contract has changed
 * and supadata-adapter.ts must be updated before any feature code runs.
 */

import { describe, expect, test } from "bun:test";
import {
  SupadataSegmentSchema,
  SupadataSyncResponseSchema,
  SupadataAsyncResponseSchema,
  SupadataJobResultSchema,
  SupadataErrorResponseSchema,
  parseSupadataResponse,
} from "./supadata-adapter";

// ─── Fixtures (representative of observed live API responses) ─────────────────

const SEGMENT_FIXTURE = {
  text: "Welcome to this talk.",
  offset: 1200,
  duration: 3400,
  lang: "en",
};

const SYNC_FIXTURE = {
  lang: "en",
  content: [
    { text: "Welcome to this talk.", offset: 1200, duration: 3400, lang: "en" },
    { text: "Today we discuss open source.", offset: 4700, duration: 2800, lang: "en" },
  ],
};

const ASYNC_FIXTURE = { jobId: "job_abc123xyz" };

const JOB_ACTIVE_FIXTURE = { status: "active" };
const JOB_COMPLETED_FIXTURE = {
  status: "completed",
  content: [{ text: "Segment from job.", offset: 0, duration: 4000, lang: "en" }],
};
const JOB_FAILED_FIXTURE = { status: "failed", error: "no captions available for this video" };

const ERROR_FIXTURE_MESSAGE = { message: "Unauthorized", statusCode: 401 };
const ERROR_FIXTURE_ERROR = { error: "Video not found", statusCode: 404 };
const ERROR_FIXTURE_UNKNOWN = { unexpected_field: "some_value", code: "WEIRD" };

// ─── SupadataSegmentSchema ────────────────────────────────────────────────────

describe("SupadataSegmentSchema", () => {
  test("accepts a full segment with all fields", () => {
    const result = SupadataSegmentSchema.safeParse(SEGMENT_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.text).toBe("Welcome to this talk.");
    expect(result.data.offset).toBe(1200);
    expect(result.data.duration).toBe(3400);
    expect(result.data.lang).toBe("en");
  });

  test("accepts a segment without the optional lang field", () => {
    const { lang: _lang, ...noLang } = SEGMENT_FIXTURE;
    expect(SupadataSegmentSchema.safeParse(noLang).success).toBe(true);
  });

  test("rejects when text is missing", () => {
    const { text: _text, ...noText } = SEGMENT_FIXTURE;
    expect(SupadataSegmentSchema.safeParse(noText).success).toBe(false);
  });

  test("rejects when offset is a string rather than a number", () => {
    expect(
      SupadataSegmentSchema.safeParse({ ...SEGMENT_FIXTURE, offset: "1200" }).success,
    ).toBe(false);
  });

  test("rejects when duration is a string rather than a number", () => {
    expect(
      SupadataSegmentSchema.safeParse({ ...SEGMENT_FIXTURE, duration: "3400" }).success,
    ).toBe(false);
  });

  test("offset and duration are preserved as numbers (milliseconds, not seconds)", () => {
    const result = SupadataSegmentSchema.parse(SEGMENT_FIXTURE);
    // Supadata uses ms; transcript.server.ts divides by 1000 when building Cues.
    // Verify the adapter doesn't silently convert — that's the caller's job.
    expect(result.offset).toBe(1200);
    expect(result.duration).toBe(3400);
  });
});

// ─── SupadataSyncResponseSchema ───────────────────────────────────────────────

describe("SupadataSyncResponseSchema (HTTP 200)", () => {
  test("parses a typical sync response with segment array", () => {
    const result = SupadataSyncResponseSchema.safeParse(SYNC_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lang).toBe("en");
    expect(Array.isArray(result.data.content)).toBe(true);
    expect((result.data.content as unknown[]).length).toBe(2);
  });

  test("content field name is exactly 'content' (not 'segments' or 'items')", () => {
    const wrongField = { lang: "en", segments: SYNC_FIXTURE.content };
    expect(SupadataSyncResponseSchema.safeParse(wrongField).success).toBe(false);
  });

  test("lang field name is exactly 'lang' (not 'language' or 'languageCode')", () => {
    // lang is optional — but when present the key must be "lang"
    const result = SupadataSyncResponseSchema.safeParse({ lang: "fr", content: [] });
    expect(result.success).toBe(true);
  });

  test("accepts missing lang (optional field)", () => {
    const { lang: _lang, ...noLang } = SYNC_FIXTURE;
    expect(SupadataSyncResponseSchema.safeParse(noLang).success).toBe(true);
  });

  test("accepts plain string content (text=true mode, though we never request it)", () => {
    const textMode = { lang: "en", content: "Full transcript as a single string." };
    expect(SupadataSyncResponseSchema.safeParse(textMode).success).toBe(true);
  });

  test("rejects when content is absent entirely", () => {
    expect(SupadataSyncResponseSchema.safeParse({ lang: "en" }).success).toBe(false);
  });

  test("segments within content are fully validated", () => {
    const badSegment = { lang: "en", content: [{ text: 42, offset: "bad", duration: null }] };
    expect(SupadataSyncResponseSchema.safeParse(badSegment).success).toBe(false);
  });
});

// ─── SupadataAsyncResponseSchema ──────────────────────────────────────────────

describe("SupadataAsyncResponseSchema (HTTP 202)", () => {
  test("parses a 202 body with a jobId", () => {
    const result = SupadataAsyncResponseSchema.safeParse(ASYNC_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.jobId).toBe("job_abc123xyz");
  });

  test("jobId field name is exactly 'jobId' (camelCase, not job_id or id)", () => {
    expect(SupadataAsyncResponseSchema.safeParse({ job_id: "x" }).success).toBe(false);
    expect(SupadataAsyncResponseSchema.safeParse({ id: "x" }).success).toBe(false);
  });

  test("rejects when jobId is missing", () => {
    expect(SupadataAsyncResponseSchema.safeParse({}).success).toBe(false);
  });

  test("rejects when jobId is not a string", () => {
    expect(SupadataAsyncResponseSchema.safeParse({ jobId: 12345 }).success).toBe(false);
  });
});

// ─── SupadataJobResultSchema ──────────────────────────────────────────────────

describe("SupadataJobResultSchema (job poll endpoint)", () => {
  test("parses a queued job", () => {
    const result = SupadataJobResultSchema.safeParse({ status: "queued" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("queued");
  });

  test("parses an in-progress job", () => {
    const result = SupadataJobResultSchema.safeParse(JOB_ACTIVE_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
  });

  test("parses a completed job with content", () => {
    const result = SupadataJobResultSchema.safeParse(JOB_COMPLETED_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("completed");
    expect(Array.isArray(result.data.content)).toBe(true);
  });

  test("parses a failed job with error string", () => {
    const result = SupadataJobResultSchema.safeParse(JOB_FAILED_FIXTURE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("failed");
    expect(result.data.error).toBe("no captions available for this video");
  });

  test("rejects unknown status values", () => {
    expect(SupadataJobResultSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(SupadataJobResultSchema.safeParse({ status: "done" }).success).toBe(false);
  });

  test("error field name is exactly 'error' (not 'message' or 'reason')", () => {
    const wrongKey = { status: "failed", message: "some error" };
    const result = SupadataJobResultSchema.parse(wrongKey);
    // 'message' is not a known field → error should be undefined
    expect(result.error).toBeUndefined();
  });
});

// ─── SupadataErrorResponseSchema ──────────────────────────────────────────────

describe("SupadataErrorResponseSchema (error bodies)", () => {
  test("parses a 'message' style error (auth failures)", () => {
    const result = SupadataErrorResponseSchema.safeParse(ERROR_FIXTURE_MESSAGE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.message).toBe("Unauthorized");
    expect(result.data.statusCode).toBe(401);
  });

  test("parses an 'error' style error (resource not found)", () => {
    const result = SupadataErrorResponseSchema.safeParse(ERROR_FIXTURE_ERROR);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.error).toBe("Video not found");
    expect(result.data.statusCode).toBe(404);
  });

  test("accepts unknown error shapes via passthrough (schema drift doesn't throw)", () => {
    const result = SupadataErrorResponseSchema.safeParse(ERROR_FIXTURE_UNKNOWN);
    expect(result.success).toBe(true);
  });

  test("all optional — an empty object is a valid (if unhelpful) error body", () => {
    expect(SupadataErrorResponseSchema.safeParse({}).success).toBe(true);
  });
});

// ─── parseSupadataResponse (parse boundary) ───────────────────────────────────

describe("parseSupadataResponse", () => {
  test("routes HTTP 200 to kind='sync'", () => {
    const result = parseSupadataResponse(200, SYNC_FIXTURE);
    expect(result.kind).toBe("sync");
    if (result.kind !== "sync") return;
    expect(result.data.lang).toBe("en");
  });

  test("routes HTTP 202 to kind='async'", () => {
    const result = parseSupadataResponse(202, ASYNC_FIXTURE);
    expect(result.kind).toBe("async");
    if (result.kind !== "async") return;
    expect(result.data.jobId).toBe("job_abc123xyz");
  });

  test("routes HTTP 401 to kind='error' with status preserved", () => {
    const result = parseSupadataResponse(401, ERROR_FIXTURE_MESSAGE);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.status).toBe(401);
  });

  test("routes HTTP 404 to kind='error'", () => {
    const result = parseSupadataResponse(404, ERROR_FIXTURE_ERROR);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.status).toBe(404);
  });

  test("routes HTTP 429 to kind='error'", () => {
    const result = parseSupadataResponse(429, { message: "Rate limit exceeded" });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.status).toBe(429);
  });

  test("kind='error' preserves raw body even when it doesn't match the error schema", () => {
    const weird = "not json at all";
    const result = parseSupadataResponse(500, weird);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.raw).toBe(weird);
  });

  test("returns kind='error' for a 200 with a schema-violating body", () => {
    const result = parseSupadataResponse(200, { wrong: "shape" });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.status).toBe(200);
    expect(result.raw).toEqual({ wrong: "shape" });
  });

  test("returns kind='error' for a 202 with a missing jobId", () => {
    const result = parseSupadataResponse(202, {});
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.status).toBe(202);
  });
});
