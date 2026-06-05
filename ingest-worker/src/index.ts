import { fetchOEmbed, fetchTranscript, assessTranscriptQuality, IngestError } from "./ingest.ts";
import { generateLesson, buildLesson } from "./lesson.ts";
import { updateJob, saveLesson } from "./supabase.ts";

const INGEST_SECRET = process.env.INGEST_SECRET;
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

if (!INGEST_SECRET) {
  console.error("[worker] INGEST_SECRET env var is required");
  process.exit(1);
}

async function processIngest(youtubeId: string, jobId: string) {
  try {
    await updateJob(jobId, "fetching_metadata");
    const meta = await fetchOEmbed(youtubeId);

    await updateJob(jobId, "reading_transcript");
    const { cues, languageCode } = await fetchTranscript(youtubeId);

    const duration = Math.max(60, Math.ceil(cues[cues.length - 1].start + (cues[cues.length - 1].dur || 4)));
    if (duration < 5 * 60) throw new IngestError("TOO_SHORT", "Video is shorter than the 5-minute minimum");
    if (duration > 90 * 60) throw new IngestError("TOO_LONG", "Video is longer than the 90-minute maximum");

    const quality = assessTranscriptQuality({ durationSeconds: duration, language: languageCode, cues });
    if (!quality.ok) throw new IngestError(quality.code, quality.detail);

    await updateJob(jobId, "generating_lesson");

    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    const lesson = apiKey
      ? await generateLesson({ apiKey, model: process.env.OPENAI_MODEL, meta, cues })
      : buildLesson(meta, cues);

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
      const secret = req.headers.get("x-ingest-secret");
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
