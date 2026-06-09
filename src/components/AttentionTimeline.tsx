import type { Segment } from "@/lib/lessonSchema";
import { fmtRange } from "@/lib/lessonSchema";

const kindStyles: Record<
  Segment["kind"],
  { bar: string; chip: string; dot: string; label: string }
> = {
  watch: {
    bar: "bg-primary/20",
    chip: "bg-primary/15 text-primary border-primary/50",
    dot: "bg-primary",
    label: "Watch",
  },
  core: {
    bar: "bg-secondary/35",
    chip: "bg-secondary/30 text-foreground border-secondary",
    dot: "bg-secondary",
    label: "Core",
  },
  demo: {
    bar: "bg-accent/25",
    chip: "bg-accent/20 text-foreground border-accent",
    dot: "bg-accent",
    label: "Demo",
  },
  skip: {
    bar: "bg-muted",
    chip: "bg-muted text-muted-foreground border-foreground/20",
    dot: "bg-muted-foreground",
    label: "Skip",
  },
};

// Legend order mirrors importance, brightest first.
const legendOrder: Segment["kind"][] = ["watch", "core", "demo", "skip"];

type Props = {
  segments: Segment[];
  totalDuration: number;
  onSeek?: (seconds: number) => void;
};

export function AttentionTimeline({ segments, totalDuration, onSeek }: Props) {
  const total = Math.max(totalDuration, 1);
  // Cap the stagger so a dense timeline (20+ segments) doesn't take seconds
  // to finish revealing. Entrances are CSS (animate-card-in), which the global
  // prefers-reduced-motion guard disables for users who opt out.
  const staggerAt = (i: number) => Math.min(i, 8);

  return (
    <div className="space-y-5">
      {/* Legend — so the colors in the bar are decodable at a glance. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {legendOrder.map((kind) => {
          const s = kindStyles[kind];
          return (
            <span key={kind} className="inline-flex items-center gap-2">
              <span
                className={`inline-block h-3.5 w-3.5 rounded-[5px] border-2 border-foreground ${s.dot}`}
              />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </span>
            </span>
          );
        })}
      </div>

      {/* The bar — heavy border + hard shadow, on-brand. End segments round
          their outer corners so the frame still looks clean. No overflow clip:
          the hover chips (desktop only) rise above the bar into the page
          margin; on mobile they're hidden, so nothing escapes the viewport. */}
      <div className="flex h-10 w-full rounded-2xl brutal-border bg-card brutal-shadow-sm">
        {segments.map((seg, i) => {
          const pct = ((seg.end - seg.start) / total) * 100;
          const s = kindStyles[seg.kind];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek?.(seg.start)}
              style={{ width: `${pct}%` }}
              title={`${s.label} · ${fmtRange(seg.start, seg.end)} · ${seg.title}`}
              aria-label={`Jump to ${seg.title}`}
              className={`group/seg relative h-full border-r-[3px] border-foreground last:border-r-0 ${
                i === 0 ? "rounded-l-2xl" : ""
              } ${i === segments.length - 1 ? "rounded-r-2xl" : ""} ${s.bar} transition-[filter] hover:brightness-105`}
            >
              {/* Inline label when the segment is wide enough to read. */}
              {pct > 11 && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center px-1 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground/80">
                  {s.label}
                </span>
              )}
              {/* Floating tooltip chip on hover — desktop only; touch has no
                  hover and it was the source of the mobile overflow. */}
              <span
                className={`pointer-events-none absolute -top-11 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest opacity-0 shadow-[3px_3px_0_0_var(--foreground)] transition-opacity duration-150 group-hover/seg:opacity-100 group-focus-visible/seg:opacity-100 sm:block ${s.chip}`}
              >
                {s.label} · {fmtRange(seg.start, seg.end)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Segment cards — full brutal treatment + a satisfying lift on hover. */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {segments.map((seg, i) => {
          const s = kindStyles[seg.kind];
          return (
            <li
              key={i}
              className="animate-card-in"
              style={{ animationDelay: `${staggerAt(i) * 0.05}s` }}
            >
              <button
                type="button"
                onClick={() => onSeek?.(seg.start)}
                className="group flex w-full items-start gap-3 rounded-3xl brutal-border bg-card p-4 text-left shadow-[4px_4px_0_0_var(--foreground)] transition-all duration-150 ease-[var(--ease-spring)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0_0_var(--foreground)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_var(--foreground)]"
              >
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-2 border-foreground ${s.dot} transition-transform group-hover:rotate-6`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-display text-sm font-extrabold leading-tight">
                      {seg.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {fmtRange(seg.start, seg.end)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{seg.blurb}</p>
                  <span
                    className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${s.chip}`}
                  >
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
