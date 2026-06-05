export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Bare ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live" || p === "v");
      if (i !== -1 && parts[i + 1] && /^[A-Za-z0-9_-]{11}$/.test(parts[i + 1])) return parts[i + 1];
    }
  } catch {
    /* not a url */
  }
  return null;
}