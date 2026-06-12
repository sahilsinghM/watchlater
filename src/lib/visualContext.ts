import type { Segment } from "./lessonSchema";

export type VisualDependency = {
  isVisuallyDependent: boolean;
  demoPct: number;
  // high = mostly or entirely demo; low = borderline
  confidence: "high" | "low";
};

// Threshold above which we consider a video visually dependent.
// Chosen at >30% because at that point missing frames meaningfully hurt
// comprehension; at or below 30% the lesson text carries the content.
const DEMO_THRESHOLD_PCT = 30;

export function detectVisualDependency(segments: Segment[]): VisualDependency {
  if (segments.length === 0) {
    return { isVisuallyDependent: false, demoPct: 0, confidence: "low" };
  }

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  if (totalDuration === 0) {
    return { isVisuallyDependent: false, demoPct: 0, confidence: "low" };
  }

  const demoDuration = segments
    .filter((s) => s.kind === "demo")
    .reduce((sum, s) => sum + (s.end - s.start), 0);

  const demoPct = (demoDuration / totalDuration) * 100;
  const isVisuallyDependent = demoPct > DEMO_THRESHOLD_PCT;
  const confidence = demoPct > 60 ? "high" : "low";

  return { isVisuallyDependent, demoPct, confidence };
}
