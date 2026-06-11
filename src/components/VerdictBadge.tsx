import type { Lesson } from "@/lib/lessonSchema";
import { WatchScoreDial } from "@/components/WatchScoreDial";

// The watch verdict — score dial + verdict line + one-line reason — as ONE
// presentational component. The lesson hero (mobile + desktop), the done
// screen, and the OG card all consume this so the product's core answer
// ("is this worth my time?") can't fork into diverging variants.
// Pure props in, markup out: no fetching, no state.

const VERDICT_LABEL: Record<NonNullable<Lesson["watchVerdict"]>, string> = {
  skip: "Skip it",
  lesson_only: "The lesson is enough",
  watch_core: "Worth your time",
  watch_full: "Watch it all",
};

type Props = {
  score: number;
  difficulty: Lesson["difficulty"];
  verdict: Lesson["watchVerdict"];
  reason: string;
  className?: string;
};

export function VerdictBadge({ score, difficulty, verdict, reason, className = "" }: Props) {
  return (
    <div
      className={`rounded-3xl brutal-border bg-card p-5 flex items-center gap-5 brutal-shadow-sm ${className}`}
    >
      <WatchScoreDial score={score} />
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Watch Score
        </div>
        <div className="font-display text-lg font-extrabold leading-tight">
          {difficulty} · {VERDICT_LABEL[verdict ?? "watch_core"]}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{reason}</p>
      </div>
    </div>
  );
}
