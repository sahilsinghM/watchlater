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

const INNERTUBE_CLIENTS = [
  {
    name: "ANDROID",
    ver: "20.10.38",
    ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    name: "IOS",
    ver: "20.10.38",
    ua: "com.google.ios.youtube/20.10.38 (iPhone; U; CPU OS 17_0)",
  },
  {
    name: "TVHTML5_SIMPLY",
    ver: "7.20250105.00.00",
    ua:
      "Mozilla/5.0 (ChromiumStyle; Linux) AppleWebKit/537.36 (KHTML, like Gecko) FreeBSD/13.2",
  },
];

// Walk a JSON string from a known `{` offset and return the slice for the
// matching `}`, handling nested objects. Returns null if the braces are
// unbalanced (e.g. the page was truncated mid-stream).
function extractBalancedJSON(html: string, key: string): unknown | null {
  const keyIdx = html.indexOf(`${key} = `);
  if (keyIdx === -1) return null;
  const start = html.indexOf("{", keyIdx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

// Fallback: parse caption track URLs directly from the YouTube watch page.
// Used when InnerTube clients are blocked by YouTube on datacenter IPs (e.g.
// Vercel), which return LOGIN_REQUIRED / UNPLAYABLE even for public videos.
async function extractCaptionTracksFromWatchPage(
  youtubeId: string,
): Promise<Array<{ baseUrl: string; languageCode?: string; kind?: string }>> {
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${youtubeId}&hl=en`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const pr = extractBalancedJSON(html, "ytInitialPlayerResponse") as any;
    if (!pr) return [];
    const tracks: unknown[] | undefined =
      pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return [];
    return tracks as Array<{ baseUrl: string; languageCode?: string; kind?: string }>;
  } catch (e) {
    console.warn("[ingest] watch-page fallback failed:", e);
    return [];
  }
}

async function fetchTranscript(youtubeId: string): Promise<{ cues: Cue[]; languageCode: string }> {
  let captionTracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }> = [];

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.ua,
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.name,
                clientVersion: client.ver,
              },
            },
            videoId: youtubeId,
          }),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const tracks: unknown[] | undefined =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        const en = tracks.find(
          (t: any) => t.languageCode === "en" && !t.kind,
        );
        captionTracks = en ? [en] : [tracks[0]];
        break; // got tracks, stop trying clients
      }
      const ps = data?.playabilityStatus?.status;
      if (ps === "LOGIN_REQUIRED" || ps === "UNPLAYABLE") {
        console.warn(
          "[ingest]",
          client.name,
          "playability:",
          ps,
          data?.playabilityStatus?.reason,
        );
      }
    } catch (e) {
      console.warn("[ingest] InnerTube", client.name, "failed:", e);
    }
  }

  // If all InnerTube clients were blocked (common on datacenter IPs like
  // Vercel), fall back to parsing the public watch page HTML.
  if (captionTracks.length === 0) {
    console.warn("[ingest] all InnerTube clients blocked, trying watch-page fallback");
    const fallbackTracks = await extractCaptionTracksFromWatchPage(youtubeId);
    if (fallbackTracks.length > 0) {
      const en = fallbackTracks.find(
        (t) => t.languageCode === "en" && !t.kind,
      );
      captionTracks = en ? [en] : [fallbackTracks[0]];
    }
  }

  if (captionTracks.length === 0) {
    throw new IngestError("NO_CAPTIONS", "This video has no captions");
  }

  const track = captionTracks[0];

  const xml = await fetchCaptionXml(track.baseUrl, youtubeId);
  if (!xml) {
    throw new IngestError("NO_CAPTIONS", "Could not download captions");
  }

  const cues: Cue[] = [];
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml))) {
    const startMs = parseInt(m[1], 10);
    const durMs = parseInt(m[2], 10);
    const inner = m[3];
    let text = "";
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sm: RegExpExecArray | null;
    while ((sm = sRegex.exec(inner))) {
      text += sm[1];
    }
    if (!text) text = inner.replace(/<[^>]+>/g, "");
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
        String.fromCodePoint(parseInt(h, 16)),
      )
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .trim();
    if (text) {
      cues.push({ start: startMs / 1000, dur: durMs / 1000, text });
    }
  }

  if (cues.length === 0) {
    const classicRe = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
    while ((m = classicRe.exec(xml))) {
      const text = m[3]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        cues.push({
          start: parseFloat(m[1]),
          dur: parseFloat(m[2] ?? "0"),
          text,
        });
      }
    }
  }

  if (cues.length === 0) {
    throw new IngestError("NO_CAPTIONS", "Captions were empty");
  }
  return { cues, languageCode: track.languageCode ?? "en" };
}

async function fetchCaptionXml(
  baseUrl: string,
  youtubeId: string,
): Promise<string | null> {
  // Try the transcript baseUrl from the player response.
  for (const ua of [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)",
    "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    "com.google.ios.youtube/20.10.38 (iPhone; U; CPU OS 17_0)",
  ]) {
    try {
      const res = await fetch(baseUrl, {
        headers: { "User-Agent": ua },
      });
      if (res.ok) {
        const body = await res.text();
        if (body.trim()) return body;
      }
    } catch {
      // try next ua
    }
  }

  return null;
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
    // H2: declare job outside try so the outer catch can mark it failed
    let jobId: string | undefined;
    try {
      const session = await ensureAnonymousSession(store, "server-anonymous-session");
      const job = await store.createProcessingJob({
        sessionId: session.id,
        youtubeId,
        rawInput: `https://www.youtube.com/watch?v=${youtubeId}`,
      });
      jobId = job.id;
      await store.updateProcessingJob(job.id, {
        status: "fetching_metadata",
        currentStep: "fetching_metadata",
      });
      let meta: { title: string; channel: string; thumbnail: string };
      try {
        meta = await fetchOEmbed(youtubeId);
      } catch (e) {
        console.warn("[ingest] oEmbed failed:", (e as IngestError)?.message);
        throw e; // outer catch marks job failed
      }
      const fullMeta: Meta = { youtubeId, ...meta };
      await store.updateProcessingJob(job.id, {
        status: "reading_transcript",
        currentStep: "reading_transcript",
      });
      let cues: Cue[];
      let languageCode = "en";
      try {
        const transcript = await fetchTranscript(youtubeId);
        cues = transcript.cues;
        languageCode = transcript.languageCode;
      } catch (e) {
        // C1: fail closed — never fabricate a lesson from synthetic cues; outer catch marks job failed
        console.warn("[ingest] transcript fetch failed for", youtubeId, ":", e);
        throw e;
      }
      const duration = cues.length
        ? Math.max(60, Math.ceil(cues[cues.length - 1].start + (cues[cues.length - 1].dur || 4)))
        : 0;
      if (duration < 5 * 60) {
        throw new IngestError("TOO_SHORT", "Video is shorter than the 5 minute MVP minimum");
      }
      if (duration > 90 * 60) {
        throw new IngestError("TOO_LONG", "Video is longer than the 90 minute MVP maximum");
      }
      // H1: pass actual language code from the caption track, not hardcoded "en"
      const quality = assessTranscriptQuality({
        durationSeconds: duration,
        language: languageCode,
        cues,
      });
      if (!quality.ok) {
        // outer catch marks job failed with quality.code
        throw new IngestError(quality.code as IngestErrorCode, quality.detail);
      }
      await store.updateProcessingJob(job.id, {
        status: "generating_lesson",
        currentStep: "generating_lesson",
      });
      const config = getServerConfig();
      const lesson = config.openaiApiKey
        ? await generateOpenAILesson({
            apiKey: config.openaiApiKey,
            model: config.openaiModel,
            meta: fullMeta,
            cues,
          })
        : buildLesson(fullMeta, cues);
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
      // H2: mark job failed for all error paths (TOO_SHORT, TOO_LONG, generation errors, etc.)
      if (jobId) {
        try {
          await store.updateProcessingJob(jobId, {
            status: "failed",
            currentStep: "failed",
            errorCode: code,
            errorDetail: err?.message ?? "Ingest failed",
          });
        } catch {
          // ignore — don't mask the original error
        }
      }
      throw new Error(`INGEST:${code}:${err?.message ?? "Failed to load video"}`);
    }
  });

export function parseIngestError(message: string): { code: IngestErrorCode; detail: string } {
  const m = /^INGEST:([A-Z_]+):(.*)$/.exec(message);
  if (!m) return { code: "UNKNOWN", detail: message };
  return { code: m[1] as IngestErrorCode, detail: m[2] };
}
