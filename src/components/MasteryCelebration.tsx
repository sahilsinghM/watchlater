import { useEffect, useRef, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { masteryResult } from "@/lib/mastery";

// The earned moment at the end of a lesson: the mastery dial spring-fills,
// the percentage counts up, and the result is shareable. Pure presentation —
// all math lives in masteryResult. Reduced-motion users get the final state
// immediately (no fill animation, no count-up).

const TIER_STROKE: Record<string, string> = {
  high: "text-accent",
  mid: "text-primary",
  low: "text-secondary",
};

type Props = {
  score: number;
  total: number;
  videoTitle: string;
  sharePath: string;
};

export function MasteryCelebration({ score, total, videoTitle, sharePath }: Props) {
  const mastery = masteryResult(score, total);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Dial fill: render at 0, then set the real value next frame so the CSS
  // spring transition plays. Reduced motion renders the final state directly.
  const [fill, setFill] = useState(reduceMotion ? mastery.pct : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const id = requestAnimationFrame(() => setFill(mastery.pct));
    return () => cancelAnimationFrame(id);
  }, [mastery.pct, reduceMotion]);

  // Count-up number synced to the ~900ms dial fill.
  const [shown, setShown] = useState(reduceMotion ? mastery.pct : 0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduceMotion) return;
    let raf: number;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const progress = Math.min(1, (t - startRef.current) / 900);
      // ease-out so the last digits settle gently
      setShown(Math.round(mastery.pct * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mastery.pct, reduceMotion]);

  const r = 54;
  const c = 2 * Math.PI * r;

  return (
    <div className="rounded-[32px] brutal-border bg-card p-5 sm:p-8 brutal-shadow space-y-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Mastery
      </div>

      <div className="relative mx-auto grid h-36 w-36 place-items-center">
        <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
          <circle
            cx="72"
            cy="72"
            r={r}
            stroke="currentColor"
            className="text-foreground/10"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="72"
            cy="72"
            r={r}
            stroke="currentColor"
            className={TIER_STROKE[mastery.tier]}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fill / 100)}
            style={{
              transition: reduceMotion ? "none" : "stroke-dashoffset 900ms var(--ease-spring)",
            }}
          />
        </svg>
        <div
          className="absolute inset-0 grid place-items-center"
          aria-label={`${mastery.pct}% mastery`}
        >
          <div className="font-display text-4xl font-extrabold" aria-hidden>
            {shown}%
          </div>
        </div>
      </div>

      <div className="font-display text-lg font-bold">{mastery.label}</div>
      <p className="text-sm text-muted-foreground">
        You got {score} of {total} correct.
      </p>
      <div className="flex justify-center pt-1">
        <ShareButton
          path={sharePath}
          title={`${mastery.pct}% on "${videoTitle}"`}
          text={`I scored ${mastery.pct}% on "${videoTitle}" with WatchLater.`}
        />
      </div>
    </div>
  );
}
