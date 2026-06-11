import type { Tone } from "@/lib/lessonSchema";

const tones: { id: Tone; label: string; emoji: string }[] = [
  { id: "clear", label: "Clear", emoji: "💡" },
  { id: "friendly", label: "Friendly", emoji: "🤝" },
  { id: "funny", label: "Funny", emoji: "😄" },
  { id: "strict", label: "Strict", emoji: "🧐" },
];

export function ToneToggle({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border-2 border-foreground bg-card p-1 brutal-shadow-sm">
      {tones.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={
              "inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase tracking-tighter transition sm:px-3 " +
              (active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-label={t.label}
          >
            <span>{t.emoji}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
