import type { Cue, Meta } from "./buildLesson";
import { parseSupadataResponse, SupadataJobResultSchema } from "./supadata-adapter";
import type { SupadataSegment } from "./supadata-adapter";

// Server-only transcript + metadata fetching. The .server.ts suffix keeps this
// out of the client bundle. Transcript fetching is delegated to Supadata, a
// managed API that absorbs YouTube's datacenter-IP blocking and PoToken
// bot-detection server-side — which is why this can run inside a Vercel
// Function instead of a separate residential-proxy worker. See docs/decisions.md
// → Ingest Architecture.

export class IngestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Video metadata via oEmbed — a lightweight public endpoint that, unlike the
// caption path, is not IP-blocked from datacenter IPs, so a plain fetch is fine.
export async function fetchOEmbed(youtubeId: string): Promise<Meta> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`,
  )}&format=json`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) throw new IngestError("NOT_FOUND", "Video not found");
  if (res.status === 401 || res.status === 403)
    throw new IngestError("PRIVATE_OR_BLOCKED", "Video is private or blocked");
  if (!res.ok) throw new IngestError("UNKNOWN", `oEmbed failed: ${res.status}`);
  const json = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  return {
    youtubeId,
    title: json.title ?? "Untitled video",
    channel: json.author_name ?? "Unknown channel",
    thumbnail: json.thumbnail_url ?? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

const SUPADATA_BASE = "https://api.supadata.ai/v1";

function getSupadataApiKey(): string {
  const key = process.env.SUPADATA_API_KEY?.trim();
  // Fail closed on a config error rather than emitting a mystery NO_CAPTIONS.
  if (!key) throw new IngestError("UNKNOWN", "SUPADATA_API_KEY is not set");
  return key;
}

// Map Supadata's response (offset/duration in ms) onto our Cue shape (seconds),
// dropping empty-text segments.
function segmentsToCues(segments: SupadataSegment[]): Cue[] {
  const cues: Cue[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (text) cues.push({ start: seg.offset / 1000, dur: seg.duration / 1000, text });
  }
  return cues;
}

// Long videos return 202 + a jobId; poll the (free) job endpoint until complete.
async function pollSupadataJob(jobId: string, apiKey: string): Promise<SupadataSegment[]> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${SUPADATA_BASE}/transcript/${encodeURIComponent(jobId)}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new IngestError("UNKNOWN", `Supadata job poll failed: ${res.status}`);
    let pollBody: unknown;
    try {
      pollBody = await res.json();
    } catch {
      throw new IngestError("UNKNOWN", "Supadata job poll returned non-JSON");
    }
    const jobResult = SupadataJobResultSchema.safeParse(pollBody);
    if (!jobResult.success)
      throw new IngestError("UNKNOWN", "Supadata job poll returned unexpected shape");
    const { data } = jobResult;
    if (data.status === "completed") {
      if (!Array.isArray(data.content) || data.content.length === 0) {
        throw new IngestError("NO_CAPTIONS", "This video has no captions");
      }
      return data.content as SupadataSegment[];
    }
    if (data.status === "failed") {
      throw new IngestError("NO_CAPTIONS", `Transcript unavailable: ${data.error ?? "failed"}`);
    }
  }
  throw new IngestError("UNKNOWN", "Transcript job timed out");
}

export async function fetchTranscript(
  youtubeId: string,
): Promise<{ cues: Cue[]; languageCode: string }> {
  const apiKey = getSupadataApiKey();
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    text: "false", // timestamped chunks, not plain text
    lang: "en",
    mode: "native", // existing captions only; no Whisper generation (locked policy)
  });

  const res = await fetch(`${SUPADATA_BASE}/transcript?${params}`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new IngestError("UNKNOWN", "Supadata auth failed — check SUPADATA_API_KEY");
  }
  if (res.status === 404) throw new IngestError("NOT_FOUND", "Video not found");

  if (!res.ok) throw new IngestError("UNKNOWN", `Supadata request failed: ${res.status}`);

  let responseBody: unknown;
  try {
    responseBody = await res.json();
  } catch {
    throw new IngestError("UNKNOWN", "Supadata returned non-JSON response");
  }
  const parsed = parseSupadataResponse(res.status, responseBody);

  if (parsed.kind === "async") {
    const segments = await pollSupadataJob(parsed.data.jobId, apiKey);
    const cues = segmentsToCues(segments);
    if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
    return { cues, languageCode: segments[0]?.lang ?? "en" };
  }

  if (parsed.kind === "unavailable") {
    const reason = parsed.data.message ?? parsed.data.error ?? "no transcript available";
    throw new IngestError("NO_CAPTIONS", `This video has no captions (${reason})`);
  }

  if (parsed.kind === "error") {
    throw new IngestError("UNKNOWN", `Supadata response schema error (status ${parsed.status})`);
  }

  // kind === "sync"
  const { content, lang } = parsed.data;
  if (!Array.isArray(content) || content.length === 0) {
    throw new IngestError("NO_CAPTIONS", "This video has no captions");
  }
  const cues = segmentsToCues(content);
  if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
  return { cues, languageCode: lang ?? content[0]?.lang ?? "en" };
}
