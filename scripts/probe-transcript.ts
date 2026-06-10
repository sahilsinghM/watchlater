// Pre-deploy smoke test for the INLINE ingest path. Verifies the Vercel-side
// transcript client can actually pull metadata + captions for a real video via
// Supadata. Exits 1 on failure so it can gate a deploy.
//
// Usage:
//   SUPADATA_API_KEY=... bun run probe          # default TED talk
//   SUPADATA_API_KEY=... bun run probe <id>
import { fetchOEmbed, fetchTranscript } from "../src/lib/transcript.server";

const id = process.argv[2] ?? "8jPQjjsBbIc"; // a TED talk with captions
console.log(`Probing inline transcript path for videoId=${id}\n`);

let failed = false;

try {
  const meta = await fetchOEmbed(id);
  console.log(`oEmbed OK: ${meta.title} / ${meta.channel}`);
} catch (e) {
  console.log(`oEmbed FAIL: ${(e as { code?: string }).code ?? "?"} :: ${(e as Error).message}`);
  failed = true;
}

try {
  const t = await fetchTranscript(id);
  console.log(`Transcript OK: cues=${t.cues.length} lang=${t.languageCode}`);
  console.log(`first cue: ${JSON.stringify(t.cues[0])}`);
} catch (e) {
  console.log(`Transcript FAIL: ${(e as { code?: string }).code ?? "?"} :: ${(e as Error).message}`);
  failed = true;
}

if (failed) {
  console.log("\n✗ Probe failed. Check SUPADATA_API_KEY is set and the video has English captions.");
  process.exit(1);
}
console.log("\n✓ Probe passed.");
