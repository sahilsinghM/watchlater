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

const INNERTUBE_CLIENTS = [
  { name: "ANDROID", ver: "20.10.38", ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)" },
  { name: "IOS", ver: "20.10.38", ua: "com.google.ios.youtube/20.10.38 (iPhone; U; CPU OS 17_0)" },
  { name: "TVHTML5_SIMPLY", ver: "7.20250105.00.00", ua: "Mozilla/5.0 (ChromiumStyle; Linux) AppleWebKit/537.36 (KHTML, like Gecko) FreeBSD/13.2" },
];

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

async function extractCaptionTracksFromWatchPage(
  youtubeId: string,
): Promise<{ tracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }>; diag: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${youtubeId}&hl=en&gl=US&persist_hl=1&persist_gl=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Cookie": "CONSENT=YES+42; SOCS=CAISAiAD; GPS=1; YSC=dIkMoOiMZ7A; VISITOR_INFO1_LIVE=oKckVSqvaGw",
          "Referer": "https://www.google.com/",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "upgrade-insecure-requests": "1",
        },
      },
    );
    const diag0 = `wp:http=${res.status}`;
    if (!res.ok) return { tracks: [], diag: diag0 };
    const html = await res.text();
    const pr = extractBalancedJSON(html, "ytInitialPlayerResponse") as any;
    if (!pr) return { tracks: [], diag: `${diag0},parse=fail` };
    const ps = pr?.playabilityStatus?.status ?? "?";
    let tracks: unknown[] | undefined = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      const id = extractBalancedJSON(html, "ytInitialData") as any;
      const idTracks = id?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (idTracks && idTracks.length > 0) tracks = idTracks;
    }
    const diag = `${diag0},ps=${ps},tracks=${tracks?.length ?? 0}`;
    if (!tracks || tracks.length === 0) return { tracks: [], diag };
    return { tracks: tracks as Array<{ baseUrl: string; languageCode?: string; kind?: string }>, diag };
  } catch (e: any) {
    return { tracks: [], diag: `wp:err=${String(e?.message ?? e).slice(0, 80)}` };
  }
}

async function fetchCaptionXml(baseUrl: string): Promise<string | null> {
  for (const ua of [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)",
    "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    "com.google.ios.youtube/20.10.38 (iPhone; U; CPU OS 17_0)",
  ]) {
    try {
      const res = await fetch(baseUrl, { headers: { "User-Agent": ua } });
      if (res.ok) {
        const body = await res.text();
        if (body.trim()) return body;
      }
    } catch { /* try next */ }
  }
  return null;
}

export async function fetchTranscript(youtubeId: string): Promise<{ cues: Cue[]; languageCode: string }> {
  let captionTracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }> = [];
  let watchPageDiag = "";

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": client.ua },
        body: JSON.stringify({ context: { client: { clientName: client.name, clientVersion: client.ver } }, videoId: youtubeId }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tracks: unknown[] | undefined = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        const en = tracks.find((t: any) => t.languageCode === "en" && !t.kind);
        captionTracks = en ? [en as any] : [tracks[0] as any];
        break;
      }
      const ps = data?.playabilityStatus?.status;
      if (ps === "LOGIN_REQUIRED" || ps === "UNPLAYABLE") {
        console.warn(`[worker] InnerTube ${client.name}: ${ps}`);
      }
    } catch (e) {
      console.warn(`[worker] InnerTube ${client.name} failed:`, e);
    }
  }

  if (captionTracks.length === 0) {
    console.warn("[worker] all InnerTube clients blocked, trying watch-page fallback");
    const { tracks, diag } = await extractCaptionTracksFromWatchPage(youtubeId);
    watchPageDiag = diag;
    if (tracks.length > 0) {
      const en = tracks.find((t) => t.languageCode === "en" && !t.kind);
      captionTracks = en ? [en] : [tracks[0]];
    }
  }

  if (captionTracks.length === 0) {
    throw new IngestError("NO_CAPTIONS", `This video has no captions [${watchPageDiag}]`);
  }

  const track = captionTracks[0];
  const xml = await fetchCaptionXml(track.baseUrl);
  if (!xml) throw new IngestError("NO_CAPTIONS", "Could not download captions");

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
    while ((sm = sRegex.exec(inner))) text += sm[1];
    if (!text) text = inner.replace(/<[^>]+>/g, "");
    text = text
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .trim();
    if (text) cues.push({ start: startMs / 1000, dur: durMs / 1000, text });
  }

  if (cues.length === 0) {
    const classicRe = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
    while ((m = classicRe.exec(xml))) {
      const text = m[3]
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
      if (text) cues.push({ start: parseFloat(m[1]), dur: parseFloat(m[2] ?? "0"), text });
    }
  }

  if (cues.length === 0) throw new IngestError("NO_CAPTIONS", "Captions were empty");
  return { cues, languageCode: track.languageCode ?? "en" };
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
