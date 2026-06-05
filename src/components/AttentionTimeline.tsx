import type { Segment } from "@/lib/lessonSchema";
import { fmtRange } from "@/lib/lessonSchema";

const kindStyles: Record<Segment["kind"], { bg: string; label: string; dot: string }> = {
  skip: { bg: "bg-muted text-muted-foreground", label: "Skip", dot: "bg-muted-foreground" },
  watch: { bg: "bg-primary/15 text-primary", label: "Watch", dot: "bg-primary" },
  core: { bg: "bg-secondary/25 text-foreground", label: "Core", dot: "bg-secondary" },
  demo: { bg: "bg-accent/20 text-foreground", label: "Demo", dot: "bg-accent" },
};

type Props = {
  segments: Segment[];
  totalDuration: number;
  onSeek?: (seconds: number) => void;
};

export function AttentionTimeline({ segments, totalDuration, onSeek }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex h-6 w-full overflow-hidden rounded-full brutal-border bg-card">
        {segments.map((seg, i) => {
          const pct = ((seg.end - seg.start) / totalDuration) * 100;
          const s = kindStyles[seg.kind];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek?.(seg.start)}
              title={`${s.label} · ${fmtRange(seg.start, seg.end)} · ${seg.title}`}
              className={`${s.bg} h-full border-r-[3px] border-foreground last:border-r-0 hover:brightness-95 transition`}
              style={{ width: `${pct}%` }}
              aria-label={`Jump to ${seg.title}`}
            />
          );
        })}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {segments.map((seg, i) => {
          const s = kindStyles[seg.kind];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSeek?.(seg.start)}
                className="group flex w-full items-start gap-3 rounded-2xl border-2 border-foreground/10 bg-card p-3 text-left transition hover:border-foreground hover:-translate-y-0.5"
              >
                <span className={`mt-1 inline-flex h-3 w-3 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold leading-tight">
                      {seg.title}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {fmtRange(seg.start, seg.end)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{seg.blurb}</p>
                  <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${s.bg}`}>
                    {s.label}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}