// Rebuild all cached lessons by re-running the ingest pipeline on every
// youtube_id currently in the `lessons` table. Useful after a prompt or
// schema change when you want all lessons regenerated from scratch.
//
// Usage:
//   bun run ops:rebuild            # dry-run (prints count + cost estimate, exits)
//   bun run ops:rebuild -- --run   # prompts for confirmation, then rebuilds
//
// Reads SUPABASE_URL + SUPABASE_SECRET_KEY from .env (Bun auto-loads it).

import { processLesson } from "../src/lib/processLesson.server";
import {
  estimateRebuildCost,
  formatRebuildReport,
  type RebuildOutcome,
} from "../src/lib/rebuildPlan";
import * as readline from "readline";

const RUN_FLAG = process.argv.includes("--run");
const DELAY_BETWEEN_MS = 2_000; // rate-limit: 1 ingest per 2 s

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SECRET_KEY missing (set them in .env)");
  process.exit(1);
}

// ── 1. Fetch all youtube_ids from the lessons table ────────────────────────

const res = await fetch(
  `${url}/rest/v1/lessons?select=youtube_id,title&order=created_at.asc&limit=1000`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`Supabase query failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const rows = (await res.json()) as { youtube_id: string; title: string }[];

// ── 2. Print count + cost estimate ─────────────────────────────────────────

const est = estimateRebuildCost(rows.length);

console.log(`\nCached lessons: ${rows.length}`);
console.log(
  `Estimated cost: $${est.lowUsd.toFixed(4)} – $${est.highUsd.toFixed(4)} USD (rough range)`,
);

if (!RUN_FLAG) {
  console.log("\nDry run — pass --run to execute. No changes made.");
  process.exit(0);
}

// ── 3. Confirm before touching production data ──────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise<string>((resolve) => {
  rl.question(`\nRebuild ${rows.length} lessons? [y/N] `, resolve);
});
rl.close();

if (answer.trim().toLowerCase() !== "y") {
  console.log("Aborted.");
  process.exit(0);
}

// ── 4. Process serially with a delay to avoid hammering the LLM API ────────

const outcomes: RebuildOutcome[] = [];

for (let i = 0; i < rows.length; i++) {
  const { youtube_id: youtubeId, title } = rows[i];
  console.log(`\n[${i + 1}/${rows.length}] ${youtubeId}  ${title}`);

  const t0 = Date.now();
  try {
    // jobId = youtubeId so ingest logs are self-identifying without extra infra
    await processLesson(youtubeId, youtubeId);
    const durationMs = Date.now() - t0;
    console.log(`  ✓ done in ${(durationMs / 1000).toFixed(1)}s`);
    outcomes.push({ youtubeId, title, ok: true, durationMs });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${error}`);
    outcomes.push({ youtubeId, title, ok: false, error });
  }

  if (i + 1 < rows.length) {
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
  }
}

// ── 5. Print final report ───────────────────────────────────────────────────

console.log(formatRebuildReport(outcomes));
