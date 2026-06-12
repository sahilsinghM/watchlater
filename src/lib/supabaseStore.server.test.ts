/**
 * Contract tests for the Supabase MvpStore implementation.
 *
 * These tests stub the Supabase client at the injection seam so they run
 * without a live database. They verify:
 *   - The field mapping between domain types and Postgres row shapes
 *     (regression guard for the C2 bug: lesson_video_id vs lesson_id UUID FK)
 *   - That the return values are correctly shaped domain types
 *   - Fail-loud behaviour when Supabase returns an error
 *
 * The in-memory store (createMemoryMvpStore) is the test double for domain
 * behavior tests. These tests are specifically about the Supabase layer.
 */

import { describe, expect, test } from "bun:test";
import { createSupabaseStore } from "./supabaseStore.server";
import type { SupabaseClientLike } from "./supabaseStore.server";

// ─── Supabase client spy ──────────────────────────────────────────────────────

type InsertPayload = Record<string, unknown>;
type UpsertOpts = { onConflict?: string };

/**
 * Returns a minimal chainable Supabase client spy that captures what was
 * inserted/upserted and resolves with `returnRow` (or the error shape).
 */
function makeClientSpy(
  returnRow: Record<string, unknown>,
  returnError: { message: string } | null = null,
) {
  let captured: { table: string; insert?: InsertPayload; upsertOpts?: UpsertOpts } | null = null;

  function chain(table: string) {
    const c = {
      insert: (data: InsertPayload) => {
        captured = { table, insert: data };
        return c;
      },
      upsert: (data: InsertPayload, opts?: UpsertOpts) => {
        captured = { table, insert: data, upsertOpts: opts };
        return c;
      },
      update: (data: InsertPayload) => {
        captured = { table, insert: data };
        return c;
      },
      select: () => c,
      eq: () => c,
      order: () => c,
      limit: () => c,
      single: () => Promise.resolve({ data: returnError ? null : returnRow, error: returnError }),
      maybeSingle: () =>
        Promise.resolve({ data: returnError ? null : returnRow, error: returnError }),
    };
    return c;
  }

  const client = { from: (table: string) => chain(table) } as SupabaseClientLike;
  return { client, getCaptured: () => captured };
}

// ─── createProcessingJob ─────────────────────────────────────────────────────

describe("createProcessingJob", () => {
  const jobRow = {
    id: "job-uuid-1",
    session_id: "sess-1",
    youtube_id: "dQw4w9WgXcQ",
    status: "queued",
    current_step: "queued",
    error_code: null,
    error_detail: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };

  test("inserts with queued status and returns a shaped ProcessingJob", async () => {
    const { client, getCaptured } = makeClientSpy(jobRow);
    const store = createSupabaseStore(() => client);

    const result = await store.createProcessingJob({
      sessionId: "sess-1",
      youtubeId: "dQw4w9WgXcQ",
      rawInput: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    const captured = getCaptured();
    expect(captured?.table).toBe("processing_jobs");
    expect(captured?.insert).toMatchObject({
      session_id: "sess-1",
      youtube_id: "dQw4w9WgXcQ",
      status: "queued",
    });
    expect(result.id).toBe("job-uuid-1");
    expect(result.status).toBe("queued");
    expect(result.youtubeId).toBe("dQw4w9WgXcQ");
    // rawInput is stitched in after the insert (not persisted to DB)
    expect(result.input).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "foreign key violation" });
    const store = createSupabaseStore(() => client);

    await expect(
      store.createProcessingJob({ sessionId: "sess-1", youtubeId: "abc", rawInput: "https://..." }),
    ).rejects.toThrow("createProcessingJob failed");
  });
});

// ─── updateProcessingJob ──────────────────────────────────────────────────────

describe("updateProcessingJob", () => {
  const updatedRow = {
    id: "job-uuid-1",
    session_id: "sess-1",
    youtube_id: "dQw4w9WgXcQ",
    status: "ready",
    current_step: "ready",
    error_code: null,
    error_detail: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:01:00Z",
  };

  test("applies a status patch and returns the updated ProcessingJob", async () => {
    const { client } = makeClientSpy(updatedRow);
    const store = createSupabaseStore(() => client);

    const result = await store.updateProcessingJob("job-uuid-1", {
      status: "ready",
      currentStep: "ready",
    });

    expect(result.id).toBe("job-uuid-1");
    expect(result.status).toBe("ready");
  });

  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "row not found" });
    const store = createSupabaseStore(() => client);

    await expect(store.updateProcessingJob("missing-id", { status: "ready" })).rejects.toThrow(
      "updateProcessingJob failed",
    );
  });
});

// ─── upsertAnonymousSession ───────────────────────────────────────────────────

describe("upsertAnonymousSession", () => {
  const sessionRow = {
    id: "sess-uuid-1",
    session_key: "browser-key-abc",
    first_seen_at: "2026-06-01T00:00:00Z",
    last_seen_at: "2026-06-01T00:01:00Z",
  };

  test("upserts atomically and returns it shaped as AnonymousSession", async () => {
    const { client, getCaptured } = makeClientSpy(sessionRow);
    const store = createSupabaseStore(() => client);

    const result = await store.upsertAnonymousSession("browser-key-abc");

    const captured = getCaptured();
    expect(captured?.table).toBe("anonymous_sessions");
    expect(captured?.upsertOpts).toEqual({ onConflict: "session_key" });
    expect(result.id).toBe("sess-uuid-1");
    expect(result.sessionKey).toBe("browser-key-abc");
  });

  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "unique violation" });
    const store = createSupabaseStore(() => client);

    await expect(store.upsertAnonymousSession("new-key")).rejects.toThrow(
      "upsertAnonymousSession failed",
    );
  });
});

// ─── saveQuizResult ───────────────────────────────────────────────────────────

describe("saveQuizResult", () => {
  // TRACER BULLET — regression guard for C2 bug
  test("inserts lesson_id: null and maps lessonId to lesson_video_id (not the UUID FK)", async () => {
    const quizRow = {
      id: "quiz-uuid-1",
      lesson_video_id: "my-lesson-id",
      session_id: "session-uuid-1",
      answers: [0, 2, 1],
      score: 2,
      total: 3,
      completed_at: "2026-01-01T00:00:00Z",
    };
    const { client, getCaptured } = makeClientSpy(quizRow);
    const store = createSupabaseStore(() => client);

    await store.saveQuizResult({
      lessonId: "my-lesson-id",
      sessionId: "session-uuid-1",
      answers: [0, 2, 1],
      score: 2,
      total: 3,
    });

    const captured = getCaptured();
    expect(captured?.table).toBe("quiz_results");
    // lesson_id must be null — we don't expose the DB UUID at the domain layer
    expect(captured?.insert).toMatchObject({ lesson_id: null });
    // The domain lessonId is stored in lesson_video_id
    expect(captured?.insert).toMatchObject({ lesson_video_id: "my-lesson-id" });
  });

  test("returns a correctly shaped QuizResult domain object", async () => {
    const quizRow = {
      id: "quiz-uuid-1",
      lesson_video_id: "vid-1",
      session_id: "sess-1",
      answers: [1, 0],
      score: 1,
      total: 2,
      completed_at: "2026-06-01T12:00:00Z",
    };
    const { client } = makeClientSpy(quizRow);
    const store = createSupabaseStore(() => client);

    const result = await store.saveQuizResult({
      lessonId: "vid-1",
      sessionId: "sess-1",
      answers: [1, 0],
      score: 1,
      total: 2,
    });

    expect(result).toEqual({
      id: "quiz-uuid-1",
      lessonId: "vid-1",
      sessionId: "sess-1",
      answers: [1, 0],
      score: 1,
      total: 2,
      completedAt: "2026-06-01T12:00:00Z",
    });
  });
  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "unique constraint violation" });
    const store = createSupabaseStore(() => client);

    await expect(
      store.saveQuizResult({
        lessonId: "vid-1",
        sessionId: "sess-1",
        answers: [0],
        score: 1,
        total: 1,
      }),
    ).rejects.toThrow("saveQuizResult failed");
  });
});

// ─── saveFeedback ─────────────────────────────────────────────────────────────

describe("saveFeedback", () => {
  const feedbackRow = {
    id: "fb-uuid-1",
    lesson_video_id: "vid-1",
    session_id: "sess-1",
    useful: true,
    reason: "Very clear.",
    name: "Alice",
    email: "alice@example.com",
    source: "completion",
    created_at: "2026-06-01T12:00:00Z",
  };

  test("inserts lesson_id: null and maps lessonId to lesson_video_id", async () => {
    const { client, getCaptured } = makeClientSpy(feedbackRow);
    const store = createSupabaseStore(() => client);

    await store.saveFeedback({
      lessonId: "vid-1",
      sessionId: "sess-1",
      useful: true,
      source: "completion",
    });

    const captured = getCaptured();
    expect(captured?.table).toBe("feedback");
    expect(captured?.insert).toMatchObject({ lesson_id: null });
    expect(captured?.insert).toMatchObject({ lesson_video_id: "vid-1" });
  });

  test("returns a Feedback domain object with optional fields populated", async () => {
    const { client } = makeClientSpy(feedbackRow);
    const store = createSupabaseStore(() => client);

    const result = await store.saveFeedback({
      lessonId: "vid-1",
      sessionId: "sess-1",
      useful: true,
      reason: "Very clear.",
      name: "Alice",
      email: "alice@example.com",
      source: "completion",
    });

    expect(result).toEqual({
      id: "fb-uuid-1",
      lessonId: "vid-1",
      sessionId: "sess-1",
      useful: true,
      reason: "Very clear.",
      name: "Alice",
      email: "alice@example.com",
      source: "completion",
      createdAt: "2026-06-01T12:00:00Z",
    });
  });

  test("maps null optional fields to undefined on the domain type", async () => {
    const nullOptionals = {
      ...feedbackRow,
      reason: null,
      name: null,
      email: null,
    };
    const { client } = makeClientSpy(nullOptionals);
    const store = createSupabaseStore(() => client);

    const result = await store.saveFeedback({
      lessonId: "vid-1",
      sessionId: "sess-1",
      useful: false,
      source: "lesson",
    });

    expect(result.reason).toBeUndefined();
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "RLS policy violation" });
    const store = createSupabaseStore(() => client);

    await expect(
      store.saveFeedback({
        lessonId: "vid-1",
        sessionId: "sess-1",
        useful: true,
        source: "completion",
      }),
    ).rejects.toThrow("saveFeedback failed");
  });
});

// ─── saveLead ─────────────────────────────────────────────────────────────────

describe("saveLead", () => {
  const leadRow = {
    id: "lead-uuid-1",
    session_id: "sess-1",
    email: "reader@example.com",
    source: "hero",
    lesson_video_id: "vid-1",
    created_at: "2026-06-01T12:00:00Z",
  };

  test("uses upsert with onConflict: 'email' for deduplication", async () => {
    const { client, getCaptured } = makeClientSpy(leadRow);
    const store = createSupabaseStore(() => client);

    await store.saveLead({
      sessionId: "sess-1",
      email: "reader@example.com",
      source: "hero",
      lessonVideoId: "vid-1",
    });

    const captured = getCaptured();
    expect(captured?.upsertOpts).toEqual({ onConflict: "email" });
  });

  test("returns a correctly shaped Lead domain object", async () => {
    const { client } = makeClientSpy(leadRow);
    const store = createSupabaseStore(() => client);

    const result = await store.saveLead({
      sessionId: "sess-1",
      email: "reader@example.com",
      source: "hero",
      lessonVideoId: "vid-1",
    });

    expect(result).toEqual({
      id: "lead-uuid-1",
      sessionId: "sess-1",
      email: "reader@example.com",
      source: "hero",
      lessonVideoId: "vid-1",
      createdAt: "2026-06-01T12:00:00Z",
    });
  });

  test("throws when Supabase returns an error (fail-loud, not silent null)", async () => {
    const { client } = makeClientSpy({}, { message: "relation 'leads' does not exist" });
    const store = createSupabaseStore(() => client);

    await expect(
      store.saveLead({ sessionId: "sess-1", email: "x@example.com", source: "done" }),
    ).rejects.toThrow("saveLead failed");
  });
});
