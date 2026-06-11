// Pure aggregation behind the ops report (scripts/job-stats.ts). Takes raw
// processing_jobs rows, returns the numbers an operator acts on. Terminal
// statuses only — in-flight jobs are reported as a count but excluded from
// rate and duration math.

export type JobStatsRow = {
  status: string;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type JobStats = {
  total: number;
  succeeded: number;
  failed: number;
  inFlight: number;
  successRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
  failureCodes: Record<string, number>;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function aggregateJobStats(rows: JobStatsRow[]): JobStats {
  const succeededRows = rows.filter((r) => r.status === "ready");
  const failedRows = rows.filter((r) => r.status === "failed");
  const terminal = succeededRows.length + failedRows.length;

  const durations = succeededRows
    .map((r) => new Date(r.updated_at).getTime() - new Date(r.created_at).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);

  const failureCodes: Record<string, number> = {};
  for (const r of failedRows) {
    const code = r.error_code ?? "UNKNOWN";
    failureCodes[code] = (failureCodes[code] ?? 0) + 1;
  }

  return {
    total: rows.length,
    succeeded: succeededRows.length,
    failed: failedRows.length,
    inFlight: rows.length - terminal,
    successRate: terminal === 0 ? 0 : succeededRows.length / terminal,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    failureCodes,
  };
}
