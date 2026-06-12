// Cost constants derived from observed ingest runs: each lesson calls OpenRouter
// for lesson generation (~4k in / ~2k out) plus a quick scoring pass (~1k / ~0.5k).
// Using conservative Gemini Flash pricing ($0.075/Mtok in, $0.30/Mtok out) as the
// low end and GPT-4o mini pricing ($0.15/Mtok in, $0.60/Mtok out) as the high end.
const EST_INPUT_TOKENS = 5_000;
const EST_OUTPUT_TOKENS = 2_500;
const LOW_USD_PER_LESSON = (EST_INPUT_TOKENS * 0.075 + EST_OUTPUT_TOKENS * 0.3) / 1_000_000;
const HIGH_USD_PER_LESSON = (EST_INPUT_TOKENS * 0.15 + EST_OUTPUT_TOKENS * 0.6) / 1_000_000;

export interface CostEstimate {
  lessons: number;
  lowUsd: number;
  highUsd: number;
}

export function estimateRebuildCost(lessons: number): CostEstimate {
  return {
    lessons,
    lowUsd: lessons * LOW_USD_PER_LESSON,
    highUsd: lessons * HIGH_USD_PER_LESSON,
  };
}

export interface RebuildOutcome {
  youtubeId: string;
  title: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
}

export function formatRebuildReport(outcomes: RebuildOutcome[]): string {
  const ok = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  const lines: string[] = [
    `\nRebuild complete: ${ok.length} succeeded, ${failed.length} failed`,
    "",
  ];

  if (outcomes.length === 0) {
    lines.push("  No videos processed.");
  }

  for (const o of outcomes) {
    const status = o.ok ? "✓" : "✗";
    const timing = o.durationMs !== undefined ? ` (${(o.durationMs / 1000).toFixed(1)}s)` : "";
    const err = o.error ? `  ERROR: ${o.error}` : "";
    lines.push(`  ${status} ${o.youtubeId}  ${o.title}${timing}${err}`);
  }

  return lines.join("\n");
}
