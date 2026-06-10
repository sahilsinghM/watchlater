// Transcript-fetch smoke test. Verifies the ingest pipeline can actually pull
// captions for a real video via Supadata.
//
// Usage:
//   SUPADATA_API_KEY=... bun probe.ts [youtubeId]
//
// Run this after any ingest change or before deploying. Exits 1 on failure so it
// can be used as a CI / pre-deploy gate.
import { fetchOEmbed, fetchTranscript } from "./src/ingest.ts";

const id = process.argv[2] ?? "8jPQjjsBbIc"; // default: a TED talk with captions
console.log(`Probing videoId=${id}\n`);

let failed = false;

try {
  const meta = await fetchOEmbed(id);
  console.log(`oEmbed OK: ${meta.title} / ${meta.channel}`);
} catch (e: any) {
  console.log(`oEmbed FAIL: ${e.code ?? "?"} :: ${e.message}`);
  failed = true;
}

try {
  const t = await fetchTranscript(id);
  console.log(`Transcript OK: cues=${t.cues.length} lang=${t.languageCode}`);
  console.log(`first cue: ${JSON.stringify(t.cues[0])}`);
} catch (e: any) {
  console.log(`Transcript FAIL: ${e.code ?? "?"} :: ${e.message}`);
  failed = true;
}

if (failed) {
  console.log("\n✗ Probe failed. Check that SUPADATA_API_KEY is set and the video has English captions.");
  process.exit(1);
}
console.log("\n✓ Probe passed.");
