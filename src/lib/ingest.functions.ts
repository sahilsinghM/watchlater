import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildLesson, type Cue, type Meta } from "./buildLesson";
import { sampleLesson } from "@/data/sampleLesson";
import type { Lesson } from "./lessonSchema";
import { assessTranscriptQuality, ensureAnonymousSession } from "./mvpFlow";
import { getServerConfig } from "./config.server";
import { generateOpenAILesson } from "./openaiLesson.server";
import { getMvpStore } from "./mvpRuntime.server";

function syntheticCues(title: string, channel: string): Cue[] {
  // ~8 min of evenly spaced cues so buildLesson can produce segments + cards.
  const lines = [
    `Welcome back — today on ${channel} we're digging into ${title}.`,
    `Quick housekeeping before we get into it.`,
    `Here's the core idea that everything else hangs off of.`,
    `Let me show you what I mean with a concrete example.`,
    `Notice what changes when we tweak this one variable.`,
    `This is the part most people get wrong.`,
    `Step back for a second and look at the pattern.`,
    `A useful analogy: it works a lot like compounding interest.`,
    `The counter-argument is real, and worth taking seriously.`,
    `Here's the receipt — the data backs this up.`,
    `Walking through a second example to lock it in.`,
    `Common mistake number one, and how to avoid it.`,
    `Common mistake number two, slightly trickier.`,
    `Putting it all together end to end.`,
    `One subtle implication people miss.`,
    `If you only remember one thing from this video, make it this.`,
    `A short recap of the three big takeaways.`,
    `Thanks for watching — see you next time.`,
  ];
  const stride = 28;
  return lines.map((text, i) => ({ start: 30 + i * stride, dur: stride - 2, text }));
}

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

class IngestError extends Error {
  code: IngestErrorCode;
  constructor(code: IngestErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchOEmbed(youtubeId: string): Promise<{ title: string; channel: string; thumbnail: string }> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`,
  )}&format=json`;
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  if (res.status === 404) throw new IngestError("NOT_FOUND", "Video not found");
  if (res.status === 401 || res.status === 403)
    throw new IngestError("PRIVATE_OR_BLOCKED", "This video is private or embedding is blocked");
  if (!res.ok) throw new IngestError("UNKNOWN", `oEmbed failed: ${res.status}`);
  const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    title: json.title ?? "Untitled video",
    channel: json.author_name ?? "Unknown channel",
    thumbnail: json.thumbnail_url ?? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

function extractPlayerResponse(html: string): unknown | null {
  const marker = "ytInitialPlayerResponse";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const braceStart = html.indexOf("{", idx);
  if (braceStart === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const json = html.slice(braceStart, i + 1);
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string };

function pickCaptionTrack(pr: any): CaptionTrack | null {
  const tracks: CaptionTrack[] | undefined =
    pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) return null;
  const en = tracks.find((t) => t.languageCode === "en" && !t.kind);
  if (en) return en;
  const enAsr = tracks.find((t) => t.languageCode === "en");
  if (enAsr) return enAsr;
  return tracks[0];
}

function parseJson3(payload: any): Cue[] {
  const events: any[] = payload?.events ?? [];
  const cues: Cue[] = [];
  for (const ev of events) {
    if (!ev?.segs) continue;
    const text = (ev.segs as Array<{ utf8?: string }>)
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (!text) continue;
    cues.push({
      start: (ev.tStartMs ?? 0) / 1000,
      dur: (ev.dDurationMs ?? 0) / 1000,
      text,
    });
  }
  return cues;
}

function parseXml(xml: string): Cue[] {
  const cues: Cue[] = [];
  const re = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    cues.push({ start: parseFloat(m[1]), dur: parseFloat(m[2] ?? "0"), text });
  }
  return cues;
}

async function fetchTranscript(youtubeId: string): Promise<Cue[]> {
  // Strategy 1: try the public timedtext endpoint directly (works for many
  // videos with English captions without scraping the watch page, which
  // YouTube often blocks from datacenter IPs).
  for (const params of [
    `lang=en&v=${youtubeId}&fmt=json3`,
    `lang=en&v=${youtubeId}&kind=asr&fmt=json3`,
    `lang=en-US&v=${youtubeId}&fmt=json3`,
  ]) {
    try {
      const r = await fetch(`https://www.youtube.com/api/timedtext?${params}`, {
        headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
      });
      if (r.ok) {
        const text = await r.text();
        if (text.trim()) {
          try {
            const cues = parseJson3(JSON.parse(text));
            if (cues.length > 0) return cues;
          } catch {
            /* not json */
          }
        }
      }
    } catch {
      /* try next */
    }
  }

  // Strategy 2: scrape the watch page for the caption track URL.
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}&hl=en`, {
    headers: {
      "user-agent": UA,
      "accept-language": "en-US,en;q=0.9",
      cookie: "CONSENT=YES+1",
    },
  });
  if (!watchRes.ok) {
    throw new IngestError(
      watchRes.status === 404 ? "NOT_FOUND" : "UNKNOWN",
      `watch page failed: ${watchRes.status}`,
    );
  }
  const html = await watchRes.text();
  const pr = extractPlayerResponse(html);
  if (!pr) {
    console.error("[ingest] no ytInitialPlayerResponse, html length", html.length);
    throw new IngestError("UNKNOWN", "Could not read video metadata");
  }
  const status = (pr as { playabilityStatus?: { status?: string } }).playabilityStatus?.status;
  if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
    throw new IngestError("PRIVATE_OR_BLOCKED", "This video isn't playable");
  }
  const track = pickCaptionTrack(pr);
  if (!track) {
    console.error("[ingest] no caption tracks for", youtubeId);
    throw new IngestError("NO_CAPTIONS", "This video has no captions");
  }

  const jsonUrl = track.baseUrl.includes("fmt=") ? track.baseUrl : `${track.baseUrl}&fmt=json3`;
  const jsonRes = await fetch(jsonUrl, { headers: { "user-agent": UA } });
  if (jsonRes.ok) {
    try {
      const payload = await jsonRes.json();
      const cues = parseJson3(payload);
      if (cues.length > 0) return cues;
    } catch {
      /* fall through to xml */
    }
  }

  const xmlRes = await fetch(track.baseUrl, { headers: { "user-agent": UA } });
  if (!xmlRes.ok) throw new IngestError("NO_CAPTIONS", "Could not download captions");
  const xml = await xmlRes.text();
  const cues = parseXml(xml);
  if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
  return cues;
}

export const getLessonByYoutubeId = createServerFn({ method: "POST" })
  .inputValidator((input: { youtubeId: string }) =>
    z
      .object({
        youtubeId: z
          .string()
          .refine((s) => s === "sample" || /^[A-Za-z0-9_-]{11}$/.test(s), "invalid youtube id"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { youtubeId } = data;
    if (youtubeId === "sample") return sampleLesson;
    const store = getMvpStore();
    const cached = await store.getLessonByYoutubeId(youtubeId);
    if (cached) return cached;
    try {
      const session = await ensureAnonymousSession(store, "server-anonymous-session");
      const job = await store.createProcessingJob({
        sessionId: session.id,
        youtubeId,
        rawInput: `https://www.youtube.com/watch?v=${youtubeId}`,
      });
      await store.updateProcessingJob(job.id, {
        status: "fetching_metadata",
        currentStep: "fetching_metadata",
      });
      let meta: { title: string; channel: string; thumbnail: string };
      try {
        meta = await fetchOEmbed(youtubeId);
      } catch (e) {
        const err = e as IngestError;
        await store.updateProcessingJob(job.id, {
          status: "failed",
          currentStep: "failed",
          errorCode: err?.code ?? "UNKNOWN",
          errorDetail: err?.message ?? "Metadata fetch failed",
        });
        console.warn("[ingest] oEmbed failed:", err?.message);
        throw e;
      }
      const fullMeta: Meta = { youtubeId, ...meta };
      await store.updateProcessingJob(job.id, {
        status: "reading_transcript",
        currentStep: "reading_transcript",
      });
      const cues = await fetchTranscript(youtubeId);
      const duration = cues.length
        ? Math.max(60, Math.ceil(cues[cues.length - 1].start + (cues[cues.length - 1].dur || 4)))
        : 0;
      if (duration < 5 * 60) {
        throw new IngestError("TOO_SHORT", "Video is shorter than the 5 minute MVP minimum");
      }
      if (duration > 90 * 60) {
        throw new IngestError("TOO_LONG", "Video is longer than the 90 minute MVP maximum");
      }
      const quality = assessTranscriptQuality({
        durationSeconds: duration,
        language: "en",
        cues,
      });
      if (!quality.ok) {
        await store.updateProcessingJob(job.id, {
          status: "failed",
          currentStep: "failed",
          errorCode: quality.code,
          errorDetail: quality.detail,
        });
        throw new IngestError(quality.code as IngestErrorCode, quality.detail);
      }
      await store.updateProcessingJob(job.id, {
        status: "generating_lesson",
        currentStep: "generating_lesson",
      });
      const config = getServerConfig();
      const lesson =
        config.openaiApiKey
          ? await generateOpenAILesson({
              apiKey: config.openaiApiKey,
              model: config.openaiModel,
              meta: fullMeta,
              cues,
            })
          : config.allowPrototypeGeneration
          ? buildLesson(fullMeta, cues)
          : (() => {
              throw new IngestError(
                "GENERATION_FAILURE",
                "OpenAI generation is required. Set OPENAI_API_KEY or enable ALLOW_PROTOTYPE_GENERATION for development.",
              );
            })();
      await store.saveLesson({ youtubeId, lesson });
      await store.updateProcessingJob(job.id, {
        status: "ready",
        currentStep: "ready",
      });
      return lesson;
    } catch (e) {
      const err = e as IngestError;
      const code: IngestErrorCode =
        err && typeof err === "object" && "code" in err ? err.code : "UNKNOWN";
      throw new Error(`INGEST:${code}:${err?.message ?? "Failed to load video"}`);
    }
  });

export function parseIngestError(message: string): { code: IngestErrorCode; detail: string } {
  const m = /^INGEST:([A-Z_]+):(.*)$/.exec(message);
  if (!m) return { code: "UNKNOWN", detail: message };
  return { code: m[1] as IngestErrorCode, detail: m[2] };
}
