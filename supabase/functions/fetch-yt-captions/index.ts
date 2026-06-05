import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLIENTS = [
  { name: "ANDROID", ver: "20.10.38", ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)" },
  { name: "IOS", ver: "20.10.38", ua: "com.google.ios.youtube/20.10.38 (iPhone; U; CPU OS 17_0)" },
];

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { videoId } = await req.json().catch(() => ({})) as { videoId?: string };
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId))
    return new Response(JSON.stringify({ error: "invalid videoId" }), { status: 400 });

  const diags: string[] = [];

  for (const client of CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": client.ua },
        body: JSON.stringify({
          context: { client: { clientName: client.name, clientVersion: client.ver } },
          videoId,
        }),
      });
      const data = await res.json();
      const ps = data?.playabilityStatus?.status ?? "?";
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      diags.push(`${client.name}:http=${res.status},ps=${ps},tracks=${tracks.length}`);
      if (tracks.length > 0) {
        return new Response(JSON.stringify({ tracks, diag: diags.join("|") }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    } catch (e: any) {
      diags.push(`${client.name}:err=${String(e?.message).slice(0,40)}`);
    }
  }

  return new Response(JSON.stringify({ tracks: [], diag: diags.join("|") }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
