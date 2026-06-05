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
              "rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-tighter transition " +
              (active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}