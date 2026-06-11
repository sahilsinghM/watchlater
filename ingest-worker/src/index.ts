import { fetchOEmbed, fetchTranscript, assessTranscriptQuality, IngestError } from "./ingest.ts";
import { generateLesson, buildLesson } from "./lesson.ts";
import { generateAnthropicLesson } from "./anthropicLesson.ts";
import { updateJob, saveLesson } from "./supabase.ts";

const INGEST_SECRET = process.env.INGEST_SECRET;
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

if (!INGEST_SECRET) {
  console.error("[worker] INGEST_SECRET env var is required");
  process.exit(1);
}

// Mirrors the inline pipeline (src/lib/processLesson.server.ts): same caps,
// same generation precedence, same heartbeat + video-fact override. Keep the
// two in sync — a lesson must be identical whether it was built inline or here.
const MIN_DURATION = 5 * 60;
const MAX_DURATION = 12 * 60 * 60;

// The app treats a non-terminal job whose updated_at is older than 2 minutes
// as stale/abandoned (TIMEOUT in the UI, reprocessed on retry). Long-video
// generation can exceed that, so keep the job row fresh while we work.
const HEARTBEAT_MS = 45_000;

async function processIngest(youtubeId: string, jobId: string) {
  try {
    await updateJob(jobId, "fetching_metadata");
    const meta = await fetchOEmbed(youtubeId);

    await updateJob(jobId, "reading_transcript");
    const { cues, languageCode } = await fetchTranscript(youtubeId);

    const duration = Math.max(60, Math.ceil(cues[cues.length - 1].start + (cues[cues.length - 1].dur || 4)));
    if (duration < MIN_DURATION) throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
    if (duration > MAX_DURATION) throw new IngestError("TOO_LONG", "Video is longer than the 12-hour maximum");

    const quality = assessTranscriptQuality({ durationSeconds: duration, language: languageCode, cues });
    if (!quality.ok) throw new IngestError(quality.code, quality.detail);

    await updateJob(jobId, "generating_lesson");

    // Generation precedence: Claude (preferred — matches the inline path) ->
    // OpenRouter -> templated builder. Set ANTHROPIC_API_KEY to get Claude.
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    let lesson;
    const heartbeat = setInterval(() => {
      updateJob(jobId, "generating_lesson").catch(() => {});
    }, HEARTBEAT_MS);
    try {
      lesson = anthropicKey
        ? await generateAnthropicLesson({
            apiKey: anthropicKey,
            model: process.env.ANTHROPIC_MODEL,
            meta,
            cues,
            durationSeconds: duration,
          })
        : openaiKey
          ? await generateLesson({ apiKey: openaiKey, model: process.env.OPENAI_MODEL, meta, cues })
          : buildLesson(meta, cues);
    } finally {
      clearInterval(heartbeat);
    }

    // The video facts are ours, not the model's — mirror inline so duration is
    // never reported as far as the transcript the model happened to see.
    lesson = {
      ...lesson,
      video: {
        ...lesson.video,
        youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        title: meta.title,
        channel: meta.channel,
        thumbnail: meta.thumbnail,
        duration,
      },
    };

    await saveLesson(youtubeId, lesson);
    await updateJob(jobId, "ready");
    console.log(`[worker] done: ${youtubeId}`);
  } catch (e: any) {
    const code: string = e?.code ?? "UNKNOWN";
    const detail: string = e?.message ?? "Ingest failed";
    await updateJob(jobId, "failed", { errorCode: code, errorDetail: detail }).catch(() => {});
    console.error(`[worker] failed ${youtubeId}: [${code}] ${detail}`);
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/ingest") {
      // Vercel's dispatch (resolveIngestTarget in src/lib/ingest.functions.ts)
      // sends `Authorization: Bearer <secret>` — accept that, plus the legacy
      // x-ingest-secret header for manual curl testing.
      const auth = req.headers.get("authorization");
      const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
      const secret = bearer ?? req.headers.get("x-ingest-secret");
      if (secret !== INGEST_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      let body: { youtubeId: string; jobId: string };
      try {
        body = await req.json();
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      if (!body.youtubeId || !body.jobId) {
        return new Response("Bad Request: youtubeId and jobId required", { status: 400 });
      }
      // Fire and forget — response returns immediately so Vercel doesn't wait
      processIngest(body.youtubeId, body.jobId).catch((err) =>
        console.error("[worker] unhandled:", err),
      );
      return new Response("Accepted", { status: 202 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[worker] listening on port ${PORT}`);
