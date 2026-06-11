import type { LessonCard as LessonCardT, Tone } from "@/lib/lessonSchema";
import { fmtTime } from "@/lib/lessonSchema";

const kindLabel: Record<LessonCardT["kind"], string> = {
  concept: "Key Concept",
  analogy: "Analogy",
  quote: "The Quote",
  insight: "Insight",
  recap: "Remember This",
};

const kindAccent: Record<LessonCardT["kind"], string> = {
  concept: "bg-secondary/25 text-foreground border-secondary",
  analogy: "bg-primary/15 text-primary border-primary/50",
  quote: "bg-accent/20 text-foreground border-accent",
  insight: "bg-primary/15 text-primary border-primary/50",
  recap: "bg-secondary/25 text-foreground border-secondary",
};

// Tone tweaks the lead-in copy on the body. The card itself stays the same.
const toneLeadIn: Record<Tone, (k: LessonCardT["kind"]) => string | null> = {
  clear: () => null,
  friendly: (k) => (k === "concept" ? "Okay — here's the gist: " : null),
  funny: (k) =>
    k === "concept"
      ? "Brace yourself, hot take incoming: "
      : k === "recap"
        ? "Tattoo this on your forearm: "
        : null,
  strict: (k) => (k === "concept" ? "Pay attention. " : k === "recap" ? "Do not forget: " : null),
};

type Props = {
  card: LessonCardT;
  tone: Tone;
  onSeek?: (s: number) => void;
  direction: 1 | -1;
};

export function LessonCardView({ card, tone, onSeek }: Props) {
  const lead = toneLeadIn[tone](card.kind);
  return (
    <div className="relative">
      {/* Deck layers are OFFSET only, never rotated (owner decision 2026-06-11). */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[32px] bg-secondary brutal-border" />
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-[32px] bg-accent brutal-border" />
      {/* key={card.id} remounts the card so the CSS card-in entrance replays. */}
      <div
        key={card.id}
        className="relative rounded-[32px] bg-card brutal-border p-5 sm:p-8 md:p-10 space-y-6 animate-card-in"
      >
        <div className="flex items-center justify-between">
          <span
            className={
              "inline-block rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-tighter " +
              kindAccent[card.kind]
            }
          >
            {kindLabel[card.kind]}
          </span>
          {card.timestamp !== undefined && onSeek && (
            <button
              type="button"
              onClick={() => onSeek(card.timestamp!)}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition"
            >
              @ {fmtTime(card.timestamp)} ↗
            </button>
          )}
        </div>

        <h2 className="vs-h2">{card.title}</h2>

        <p className="text-lg leading-relaxed text-foreground/80">
          {lead && <span className="font-semibold text-foreground">{lead}</span>}
          {card.body}
        </p>

        {card.analogy && (
          <div className="rounded-2xl border-2 border-dashed border-foreground/20 bg-background p-5 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              The analogy
            </p>
            <p className="text-base font-medium italic text-foreground/85">{card.analogy}</p>
          </div>
        )}

        {card.quote && (
          <blockquote className="border-l-4 border-primary pl-5">
            <p className="font-display text-2xl font-bold italic leading-snug">“{card.quote}”</p>
            {card.quoteAuthor && (
              <footer className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                — {card.quoteAuthor}
              </footer>
            )}
          </blockquote>
        )}
      </div>
    </div>
  );
}
