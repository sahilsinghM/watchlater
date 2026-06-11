type Props = { score: number };

export function WatchScoreDial({ score }: Props) {
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          stroke="currentColor"
          className="text-foreground/10"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          stroke="currentColor"
          className="text-primary"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-spring)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold leading-none text-foreground">
            {score.toFixed(1)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            / 10
          </div>
        </div>
      </div>
    </div>
  );
}
