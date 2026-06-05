import { createClient } from "@supabase/supabase-js";
import type { Lesson } from "./schema.ts";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

type ProcessingStatus = "queued" | "fetching_metadata" | "reading_transcript" | "generating_lesson" | "ready" | "failed";

export async function updateJob(
  jobId: string,
  status: ProcessingStatus,
  extra?: { errorCode?: string; errorDetail?: string },
) {
  const supabase = getClient();
  const updates: Record<string, unknown> = {
    status,
    current_step: status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.errorCode !== undefined) updates.error_code = extra.errorCode;
  if (extra?.errorDetail !== undefined) updates.error_detail = extra.errorDetail;
  const { error } = await supabase.from("processing_jobs").update(updates).eq("id", jobId);
  if (error) console.warn("[worker] updateJob failed:", error.message);
}

export async function saveLesson(youtubeId: string, lesson: Lesson) {
  const supabase = getClient();
  const { data: existing } = await supabase
    .from("lessons")
    .select("id")
    .eq("youtube_id", youtubeId)
    .eq("schema_version", "lesson.v1")
    .maybeSingle();
  if (existing) {
    await supabase.from("lessons").update({ lesson_json: lesson, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("lessons").insert({ youtube_id: youtubeId, video_id: null, schema_version: "lesson.v1", lesson_json: lesson });
  }
}
