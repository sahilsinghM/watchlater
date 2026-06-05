import type { MvpStore, AnonymousSession, ProcessingJob, KeyFrame, QuizResult, Feedback } from "./mvpFlow";
import type { Lesson } from "./lessonSchema";
import { getSupabaseAdmin } from "./supabase-admin.server";

function parseAnonymousSession(row: any): AnonymousSession {
  return { id: row.id, sessionKey: row.session_key, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at };
}

function parseProcessingJob(row: any): ProcessingJob {
  return {
    id: row.id,
    sessionId: row.session_id,
    youtubeId: row.youtube_id,
    input: row.input ?? "",
    status: row.status,
    currentStep: row.current_step,
    errorCode: row.error_code ?? undefined,
    errorDetail: row.error_detail ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseStore(): MvpStore {
  return {
    async upsertAnonymousSession(sessionKey) {
      const supabase = getSupabaseAdmin();
      const { data: existing } = await supabase
        .from("anonymous_sessions")
        .select("*")
        .eq("session_key", sessionKey)
        .maybeSingle();
      if (existing) {
        const { data } = await supabase
          .from("anonymous_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("*")
          .single();
        return parseAnonymousSession(data ?? existing);
      }
      const { data } = await supabase
        .from("anonymous_sessions")
        .insert({ session_key: sessionKey })
        .select("*")
        .single();
      return parseAnonymousSession(data!);
    },

    async getAnonymousSession(sessionKey) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("anonymous_sessions")
        .select("*")
        .eq("session_key", sessionKey)
        .maybeSingle();
      return data ? parseAnonymousSession(data) : null;
    },

    async createProcessingJob({ sessionId, youtubeId, rawInput }) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("processing_jobs")
        .insert({
          session_id: sessionId,
          youtube_id: youtubeId,
          status: "queued",
          current_step: "queued",
        })
        .select("*")
        .single();
      const row = { ...data!, input: rawInput };
      return parseProcessingJob(row);
    },

    async getProcessingJob(id) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("processing_jobs").select("*").eq("id", id).maybeSingle();
      return data ? parseProcessingJob(data) : null;
    },

    async getActiveJobByYoutubeId(youtubeId) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("youtube_id", youtubeId)
        .neq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? parseProcessingJob(data) : null;
    },

    async updateProcessingJob(id, patch) {
      const supabase = getSupabaseAdmin();
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (patch.status) updates.status = patch.status;
      if (patch.currentStep) updates.current_step = patch.currentStep;
      if (patch.errorCode !== undefined) updates.error_code = patch.errorCode;
      if (patch.errorDetail !== undefined) updates.error_detail = patch.errorDetail;
      const { data } = await supabase.from("processing_jobs").update(updates).eq("id", id).select("*").single();
      return parseProcessingJob(data!);
    },

    async saveKeyFrames(frames) {
      const supabase = getSupabaseAdmin();
      const rows = frames.map((f) => ({
        video_id: f.videoId,
        timestamp_seconds: f.timestamp,
        storage_path: f.storagePath,
        caption: f.caption,
        capture_status: f.status,
      }));
      const { data } = await supabase.from("screenshots").insert(rows).select("*");
      const saved: KeyFrame[] = (data ?? []).map((row: any) => ({
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
      const supabase = getSupabaseAdmin();
      const videoId = `${youtubeId}_v1`;
      const { data: existingLesson } = await supabase
        .from("lessons")
        .select("id, video_id")
        .eq("youtube_id", youtubeId)
        .eq("schema_version", "lesson.v1")
        .maybeSingle();
      if (existingLesson) {
        await supabase
          .from("lessons")
          .update({ lesson_json: JSON.parse(JSON.stringify(lesson)), updated_at: new Date().toISOString() })
          .eq("id", existingLesson.id);
        return lesson;
      }
      await supabase.from("lessons").insert({
        youtube_id: youtubeId,
        video_id: existingLesson?.video_id ?? null,
        schema_version: "lesson.v1",
        lesson_json: JSON.parse(JSON.stringify(lesson)),
      });
      return lesson;
    },

    async getLessonByYoutubeId(youtubeId) {
      const supabase = getSupabaseAdmin();
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
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("quiz_results")
        .insert({
          lesson_id: null,               // UUID FK — we don't expose the DB UUID; lesson_video_id is the lookup key
          lesson_video_id: input.lessonId,
          session_id: input.sessionId,
          answers: input.answers,
          score: input.score,
          total: input.total,
        })
        .select("*")
        .single();
      return {
        id: data!.id,
        lessonId: data!.lesson_id,
        sessionId: data!.session_id,
        answers: data!.answers,
        score: data!.score,
        total: data!.total,
        completedAt: data!.completed_at,
      };
    },

    async saveFeedback(input) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("feedback")
        .insert({
          lesson_id: null,               // UUID FK — lesson_video_id is the lookup key
          lesson_video_id: input.lessonId,
          session_id: input.sessionId,
          useful: input.useful,
          reason: input.reason ?? null,
          source: input.source,
        })
        .select("*")
        .single();
      return {
        id: data!.id,
        lessonId: data!.lesson_id,
        sessionId: data!.session_id,
        useful: data!.useful,
        reason: data!.reason ?? undefined,
        source: data!.source,
        createdAt: data!.created_at,
      };
    },
  };
}
