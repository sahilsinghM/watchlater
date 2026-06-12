// Quiz score -> mastery percentage + tier. Pure; the done screen renders it,
// the share card quotes it. Same thresholds the screen always used.
export type MasteryTier = "high" | "mid" | "low";

export type Mastery = {
  pct: number;
  label: "Mastered" | "Solid grasp" | "Worth a re-read";
  tier: MasteryTier;
};

export function masteryResult(score: number, total: number): Mastery {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  if (pct >= 80) return { pct, label: "Mastered", tier: "high" };
  if (pct >= 50) return { pct, label: "Solid grasp", tier: "mid" };
  return { pct, label: "Worth a re-read", tier: "low" };
}
