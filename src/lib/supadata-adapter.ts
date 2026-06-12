/**
 * Typed adapter for the Supadata transcript API (api.supadata.ai/v1).
 *
 * All schemas were derived from observed live responses captured by
 * scripts/probe-supadata.ts. If the probe reports a schema-mismatch failure,
 * update the schemas here and re-run the contract tests.
 *
 * Public surface:
 *   - Zod schemas (for runtime parse + contract tests)
 *   - Inferred TS types (for callers)
 *   - parseSupadataResponse() — the single parse boundary used by transcript.server.ts
 */

import { z } from "zod";

// ─── Segment (one caption chunk) ─────────────────────────────────────────────

export const SupadataSegmentSchema = z.object({
  text: z.string(),
  // Supadata returns timestamps in milliseconds
  offset: z.number(),
  duration: z.number(),
  lang: z.string().optional(),
});
export type SupadataSegment = z.infer<typeof SupadataSegmentSchema>;

// ─── Sync success (HTTP 200) ──────────────────────────────────────────────────

export const SupadataSyncResponseSchema = z.object({
  lang: z.string().optional(),
  // "text: false" (our default) → array of segments
  // "text: true"                → plain string (we never request this)
  content: z.union([z.array(SupadataSegmentSchema), z.string()]),
});
export type SupadataSyncResponse = z.infer<typeof SupadataSyncResponseSchema>;

// ─── Async job (HTTP 202) ─────────────────────────────────────────────────────

export const SupadataAsyncResponseSchema = z.object({
  jobId: z.string(),
});
export type SupadataAsyncResponse = z.infer<typeof SupadataAsyncResponseSchema>;

// ─── Job poll result ──────────────────────────────────────────────────────────

export const SupadataJobStatusSchema = z.union([
  z.literal("queued"),
  z.literal("active"),
  z.literal("completed"),
  z.literal("failed"),
]);

export const SupadataJobResultSchema = z.object({
  status: SupadataJobStatusSchema,
  // Only present when status === "completed"
  content: z.union([z.array(SupadataSegmentSchema), z.string()]).optional(),
  // Only present when status === "failed"
  error: z.string().optional(),
});
export type SupadataJobResult = z.infer<typeof SupadataJobResultSchema>;

// ─── Error response ───────────────────────────────────────────────────────────

export const SupadataErrorResponseSchema = z
  .object({
    // Supadata uses either "message" or "error" depending on the error class
    message: z.string().optional(),
    error: z.string().optional(),
    statusCode: z.number().optional(),
    code: z.string().optional(),
  })
  .passthrough(); // preserve unknown fields for diagnostics
export type SupadataErrorResponse = z.infer<typeof SupadataErrorResponseSchema>;

// ─── Parse boundary ───────────────────────────────────────────────────────────

export type ParsedSupadataResponse =
  | { kind: "sync"; data: SupadataSyncResponse }
  | { kind: "async"; data: SupadataAsyncResponse }
  | { kind: "error"; status: number; data: SupadataErrorResponse; raw: unknown };

/**
 * Parse and validate a raw Supadata API response at the network boundary.
 * Returns a discriminated union — callers match on `.kind`.
 */
export function parseSupadataResponse(status: number, body: unknown): ParsedSupadataResponse {
  if (status === 202) {
    const result = SupadataAsyncResponseSchema.safeParse(body);
    if (!result.success) return { kind: "error", status, data: {}, raw: body };
    return { kind: "async", data: result.data };
  }

  if (status >= 200 && status < 300) {
    const result = SupadataSyncResponseSchema.safeParse(body);
    if (!result.success) return { kind: "error", status, data: {}, raw: body };
    return { kind: "sync", data: result.data };
  }

  // Error path — parse leniently (passthrough) so unknown error shapes are
  // still captured rather than throwing a secondary ZodError.
  const errParsed = SupadataErrorResponseSchema.safeParse(body);
  return {
    kind: "error",
    status,
    data: errParsed.success ? errParsed.data : {},
    raw: body,
  };
}
