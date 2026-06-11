// Ops report for ingest jobs. Usage:
//   bun run ops:jobs            # last 24h
//   bun run ops:jobs -- 7d      # last N d/h
// Reads SUPABASE_URL + SUPABASE_SECRET_KEY from .env (bun loads it).
import { aggregateJobStats, type JobStatsRow } from "../src/lib/jobStats";

const windowArg = process.argv[2] ?? "24h";
const m = /^(\d+)([dh])$/.exec(windowArg);
if (!m) {
  console.error(`Bad window "${windowArg}" — use e.g. 24h or 7d`);
  process.exit(1);
}
const hours = Number(m[1]) * (m[2] === "d" ? 24 : 1);
const since = new Date(Date.now() - hours * 3600_000).toISOString();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SECRET_KEY missing (set them in .env)");
  process.exit(1);
}

const res = await fetch(
  `${url}/rest/v1/processing_jobs?select=status,error_code,created_at,updated_at&created_at=gte.${since}&order=created_at.desc&limit=1000`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`Supabase query failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = (await res.json()) as JobStatsRow[];
const stats = aggregateJobStats(rows);

const fmtMs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);
console.log(`Ingest jobs — last ${windowArg} (since ${since})`);
console.log(`  total:        ${stats.total} (${stats.inFlight} in flight)`);
console.log(`  succeeded:    ${stats.succeeded}`);
console.log(`  failed:       ${stats.failed}`);
console.log(`  success rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`  duration:     p50 ${fmtMs(stats.p50Ms)} · p95 ${fmtMs(stats.p95Ms)}`);
if (Object.keys(stats.failureCodes).length) {
  console.log("  failures:");
  for (const [code, n] of Object.entries(stats.failureCodes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${code}: ${n}`);
  }
}
