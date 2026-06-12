import type {
  MvpStore,
  AnonymousSession,
  ProcessingJob,
  ProcessingStatus,
  MvpErrorCode,
  KeyFrame,
  Feedback,
  Lead,
} from "./mvpFlow";
import type { Lesson } from "./lessonSchema";
import { getSupabaseAdmin } from "./supabase-admin.server";
import type { Database } from "./database.types";

// Minimal structural type for the Supabase client used internally.
// Exported so tests can build a compatible spy without importing the real client.
export type SupabaseClientLike = ReturnType<typeof getSupabaseAdmin>;

// Generated row shapes — the compile-checked boundary between Postgres and
// the domain types. Regenerate after migrations with `bun run gen:db-types`.
type Tables = Database["public"]["Tables"];
type SessionRow = Tables["anonymous_sessions"]["Row"];
type JobRow = Tables["processing_jobs"]["Row"];
type LessonRow = Tables["lessons"]["Row"];
type QuizRow = Tables["quiz_results"]["Row"];
type FeedbackRow = Tables["feedback"]["Row"];
type LeadRow = Tables["leads"]["Row"];

function parseAnonymousSession(row: SessionRow): AnonymousSession {
  return {
    id: row.id,
    sessionKey: row.session_key,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

// The live table has no `input` column (the original URL isn't persisted) and
// session_id is nullable; the domain type wants both. Defaults applied here.
function parseProcessingJob(row: JobRow & { input?: string }): ProcessingJob {
  return {
    id: row.id,
    sessionId: row.session_id ?? "",
    youtubeId: row.youtube_id,
    input: row.input ?? "",
    status: row.status as ProcessingStatus,
    currentStep: row.current_step as ProcessingStatus,
    errorCode: (row.error_code ?? undefined) as MvpErrorCode | undefined,
    errorDetail: row.error_detail ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseStore(
  getClient: () => SupabaseClientLike = getSupabaseAdmin,
): MvpStore {
  return {
    async upsertAnonymousSession(sessionKey) {
      const supabase = getClient();
      // Atomic upsert on the unique session_key — avoids a SELECT-then-INSERT
      // race that would throw a constraint violation under concurrent SSR requests.
      const { data, error } = await supabase
        .from("anonymous_sessions")
        .upsert(
          { session_key: sessionKey, last_seen_at: new Date().toISOString() },
          { onConflict: "session_key" },
        )
        .select("*")
        .single();
      if (error || !data) throw new Error("upsertAnonymousSession failed");
      return parseAnonymousSession(data);
    },

    async getAnonymousSession(sessionKey) {
      const supabase = getClient();
      const { data } = await supabase
        .from("anonymous_sessions")
        .select("*")
        .eq("session_key", sessionKey)
        .maybeSingle();
      return data ? parseAnonymousSession(data) : null;
    },

    async createProcessingJob({ sessionId, youtubeId, rawInput }) {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("processing_jobs")
        .insert({
          session_id: sessionId,
          youtube_id: youtubeId,
          status: "queued",
          current_step: "queued",
        })
        .select("*")
        .single();
      if (error || !data) throw new Error("createProcessingJob failed");
      const row = { ...data, input: rawInput };
      return parseProcessingJob(row);
    },

    async getProcessingJob(id) {
      const supabase = getClient();
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data ? parseProcessingJob(data) : null;
    },

    async getLatestJobByYoutubeId(youtubeId) {
      const supabase = getClient();
      // No status filter: failed jobs must be visible so the processing page
      // can show their dedicated error copy instead of spinning to a generic
      // timeout (see MvpStore.getLatestJobByYoutubeId).
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("youtube_id", youtubeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? parseProcessingJob(data) : null;
    },

    async updateProcessingJob(id, patch) {
      const supabase = getClient();
      const updates: Tables["processing_jobs"]["Update"] = { updated_at: new Date().toISOString() };
      if (patch.status) updates.status = patch.status;
      if (patch.currentStep) updates.current_step = patch.currentStep;
      if (patch.errorCode !== undefined) updates.error_code = patch.errorCode;
      if (patch.errorDetail !== undefined) updates.error_detail = patch.errorDetail;
      const { data, error } = await supabase
        .from("processing_jobs")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error("updateProcessingJob failed");
      return parseProcessingJob(data);
    },

    async upsertVideo({ youtubeId, url, title, channel, thumbnailUrl, durationSeconds, language }) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("videos")
        .upsert(
          {
            youtube_id: youtubeId,
            url,
            title,
            channel,
            thumbnail_url: thumbnailUrl,
            duration_seconds: durationSeconds,
            language,
            support_status: "supported",
            metadata: {},
          },
          { onConflict: "youtube_id" },
        )
        .select("id")
        .single();
      return data!.id;
    },

    async saveKeyFrames(frames) {
      const supabase = getClient();
      const rows = frames.map((f) => ({
        video_id: f.videoId,
        timestamp_seconds: f.timestamp,
        storage_path: f.storagePath,
        caption: f.caption,
        capture_status: f.status,
      }));
      const { data } = await supabase.from("screenshots").insert(rows).select("*");
      const saved: KeyFrame[] = (data ?? []).map((row) => ({
        id: row.id,
        videoId: row.video_id,
        timestamp: row.timestamp_seconds,
        caption: row.caption ?? "",
        storagePath: row.storage_path,
        status: row.capture_status as "captured" | "degraded",
      }));
      return saved;
    },

    async saveLesson({ youtubeId, lesson }) {
      const supabase = getClient();
      const { data: existingLesson } = await supabase
        .from("lessons")
        .select("id, video_id")
        .eq("youtube_id", youtubeId)
        .eq("schema_version", "lesson.v1")
        .maybeSingle();
      if (existingLesson) {
        await supabase
          .from("lessons")
          .update({
            lesson_json: JSON.parse(JSON.stringify(lesson)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLesson.id);
        return lesson;
      }
      await supabase.from("lessons").insert({
        youtube_id: youtubeId,
        video_id: null,
        schema_version: "lesson.v1",
        lesson_json: JSON.parse(JSON.stringify(lesson)),
      });
      return lesson;
    },

    async getLessonByYoutubeId(youtubeId) {
      const supabase = getClient();
      const { data } = await supabase
        .from("lessons")
        .select("lesson_json, updated_at")
        .eq("youtube_id", youtubeId)
        .eq("schema_version", "lesson.v1")
        .maybeSingle();
      if (!data) return null;
      return data.lesson_json as unknown as Lesson;
    },

    async saveQuizResult(input) {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("quiz_results")
        .insert({
          lesson_id: null, // UUID FK — we don't expose the DB UUID; lesson_video_id is the lookup key
          lesson_video_id: input.lessonId,
          session_id: input.sessionId,
          answers: input.answers,
          score: input.score,
          total: input.total,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error("saveQuizResult failed");
      return {
        id: data.id,
        lessonId: data.lesson_video_id ?? input.lessonId,
        sessionId: data.session_id ?? "",
        answers: (data.answers as number[] | null) ?? [],
        score: data.score,
        total: data.total,
        completedAt: data.completed_at,
      };
    },

    async saveFeedback(input) {
      const supabase = getClient();
      const { data, error } = await supabase
        .from("feedback")
        .insert({
          lesson_id: null, // UUID FK — lesson_video_id is the lookup key
          lesson_video_id: input.lessonId,
          session_id: input.sessionId,
          useful: input.useful,
          reason: input.reason ?? null,
          name: input.name ?? null,
          email: input.email ?? null,
          source: input.source,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error("saveFeedback failed");
      return {
        id: data.id,
        lessonId: data.lesson_video_id ?? input.lessonId,
        sessionId: data.session_id ?? "",
        useful: data.useful,
        reason: data.reason ?? undefined,
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        source: data.source as Feedback["source"],
        createdAt: data.created_at,
      };
    },
    async saveLead(input) {
      const supabase = getClient();
      // Upsert on the unique email so the same person is captured once; a later
      // touch refreshes source/session/video but keeps the original row.
      const { data, error } = await supabase
        .from("leads")
        .upsert(
          {
            session_id: input.sessionId,
            email: input.email,
            source: input.source,
            lesson_video_id: input.lessonVideoId ?? null,
          },
          { onConflict: "email" },
        )
        .select("*")
        .single();
      // Surface the real Postgres error (e.g. missing leads table / RLS) instead
      // of letting a null row throw a cryptic "reading 'id'" further down.
      if (error || !data) {
        throw new Error(`saveLead failed: ${error?.message ?? "no row returned"}`);
      }
      return {
        id: data.id,
        sessionId: data.session_id ?? "",
        email: data.email,
        source: data.source as Lead["source"],
        lessonVideoId: data.lesson_video_id ?? undefined,
        createdAt: data.created_at,
      };
    },
  };
}
