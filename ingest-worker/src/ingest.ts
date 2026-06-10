export type Cue = { start: number; dur: number; text: string };
export type Meta = { youtubeId: string; title: string; channel: string; thumbnail: string };

export class IngestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Video metadata (title / channel / thumbnail). oEmbed is a lightweight public
// endpoint that, unlike the caption/InnerTube path, is NOT IP-blocked from
// datacenter IPs, so a plain direct fetch is fine here. If oEmbed ever starts
// failing from the deployed worker, switch this to Supadata's metadata endpoint
// (GET https://api.supadata.ai/v1/youtube/video).
export async function fetchOEmbed(youtubeId: string): Promise<Meta> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`,
  )}&format=json`;
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  if (res.status === 404) throw new IngestError("NOT_FOUND", "Video not found");
  if (res.status === 401 || res.status === 403) throw new IngestError("PRIVATE_OR_BLOCKED", "Video is private or blocked");
  if (!res.ok) throw new IngestError("UNKNOWN", `oEmbed failed: ${res.status}`);
  const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    youtubeId,
    title: json.title ?? "Untitled video",
    channel: json.author_name ?? "Unknown channel",
    thumbnail: json.thumbnail_url ?? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

// Transcript fetching is delegated entirely to Supadata, a managed API that
// absorbs YouTube's datacenter-IP blocking and PoToken bot-detection server-side.
// This replaces the previous hand-rolled InnerTube + watch-page + caption-XML +
// residential-proxy pipeline, which never worked reliably from a datacenter IP.
// See docs/decisions.md → Ingest Architecture for the full reasoning.
const SUPADATA_BASE = "https://api.supadata.ai/v1";

type SupadataSegment = { text: string; offset: number; duration: number; lang?: string };
type SupadataTranscript = { content: SupadataSegment[] | string; lang?: string };

function getSupadataApiKey(): string {
  const key = process.env.SUPADATA_API_KEY?.trim();
  if (!key) {
    // Fail closed on a config error rather than emitting a mystery NO_CAPTIONS.
    throw new IngestError("UNKNOWN", "SUPADATA_API_KEY is not set");
  }
  return key;
}

// Map Supadata's response (offset/duration in ms) onto our Cue shape (seconds),
// dropping empty-text segments — same normalisation the old XML parser did.
function segmentsToCues(segments: SupadataSegment[]): Cue[] {
  const cues: Cue[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (text) cues.push({ start: seg.offset / 1000, dur: seg.duration / 1000, text });
  }
  return cues;
}

// Long videos return 202 + a jobId; poll the job endpoint until it completes.
// Job status checks are free, so a tight ~1s interval is fine. Capped so the
// worker never hangs forever on a stuck job.
async function pollSupadataJob(jobId: string, apiKey: string): Promise<SupadataSegment[]> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) throw new IngestError("UNKNOWN", `Supadata job poll failed: ${res.status}`);
    const data = (await res.json()) as { status: string; content?: SupadataSegment[] | string; error?: string };
    if (data.status === "completed") {
      if (!Array.isArray(data.content) || data.content.length === 0) {
        throw new IngestError("NO_CAPTIONS", "This video has no captions");
      }
      return data.content;
    }
    if (data.status === "failed") {
      throw new IngestError("NO_CAPTIONS", `Transcript unavailable: ${data.error ?? "failed"}`);
    }
  }
  throw new IngestError("UNKNOWN", "Transcript job timed out");
}

export async function fetchTranscript(youtubeId: string): Promise<{ cues: Cue[]; languageCode: string }> {
  const apiKey = getSupadataApiKey();
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    text: "false", // timestamped chunks, not plain text
    lang: "en",
    mode: "native", // existing captions only; no Whisper generation (locked policy)
  });

  const res = await fetch(`${SUPADATA_BASE}/transcript?${params}`, {
    headers: { "x-api-key": apiKey },
  });

  if (res.status === 401 || res.status === 403) {
    throw new IngestError("UNKNOWN", "Supadata auth failed — check SUPADATA_API_KEY");
  }
  if (res.status === 404) {
    throw new IngestError("NOT_FOUND", "Video not found");
  }

  // 202 → async job for long videos; poll until done.
  if (res.status === 202) {
    const { jobId } = (await res.json()) as { jobId: string };
    const segments = await pollSupadataJob(jobId, apiKey);
    const cues = segmentsToCues(segments);
    if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
    return { cues, languageCode: segments[0]?.lang ?? "en" };
  }

  if (!res.ok) {
    throw new IngestError("UNKNOWN", `Supadata request failed: ${res.status}`);
  }

  const data = (await res.json()) as SupadataTranscript;
  if (!Array.isArray(data.content) || data.content.length === 0) {
    throw new IngestError("NO_CAPTIONS", "This video has no captions");
  }
  const cues = segmentsToCues(data.content);
  if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
  return { cues, languageCode: data.lang ?? data.content[0]?.lang ?? "en" };
}

export function assessTranscriptQuality(input: { durationSeconds: number; language?: string; cues: Cue[] }) {
  const cues = input.cues.filter((c) => c.text.trim().length > 0);
  const latestEnd = cues.reduce((max, c) => Math.max(max, c.start + c.dur), 0);
  const coverageRatio = input.durationSeconds > 0 ? latestEnd / input.durationSeconds : 0;
  const cueDensity = input.durationSeconds > 0 ? cues.length / (input.durationSeconds / 60) : 0;

  if (input.language && !input.language.toLowerCase().startsWith("en")) {
    return { ok: false as const, code: "NON_ENGLISH", detail: "Only English videos are supported." };
  }
  if (cues.length < 12 || cueDensity < 1 || coverageRatio < 0.25) {
    return { ok: false as const, code: "TRANSCRIPT_TOO_SPARSE", detail: "Transcript coverage is too sparse." };
  }
  const repeated = new Map<string, number>();
  for (const cue of cues) {
    const n = cue.text.toLowerCase().replace(/\s+/g, " ").trim();
    repeated.set(n, (repeated.get(n) ?? 0) + 1);
  }
  const maxRepeat = Math.max(...repeated.values());
  if (maxRepeat / cues.length > 0.4) {
    return { ok: false as const, code: "TRANSCRIPT_TOO_NOISY", detail: "Transcript is too repetitive." };
  }
  return { ok: true as const };
}
