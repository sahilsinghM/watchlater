import { useState } from "react";
import type { Lesson } from "@/lib/lessonSchema";
import { answerTutorQuestion, buildTutorContext } from "@/lib/mvpFlow";

type Msg = { role: "user" | "tutor"; text: string };

export function TutorPanel({ lesson }: { lesson: Lesson }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "tutor",
      text: "Hey! Ask me anything about this video. I only know what's in the transcript.",
    },
  ]);
  const [input, setInput] = useState("");

  function ask(q: string) {
    if (!q.trim()) return;
    const answer = answerTutorQuestion(buildTutorContext(lesson), q);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "tutor", text: answer.text }]);
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the tutor"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full p-4 sm:rounded-2xl sm:px-5 sm:py-3 sm:bottom-6 sm:right-6 bg-foreground text-background brutal-border brutal-shadow-sm font-display font-bold hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
      >
        {/* Icon-only on phones: the full pill was 173px wide and covered the
            lesson CTA, the early-access Join button, and the player's GOT IT
            reaction as content scrolled beneath it. */}
        <span>💬</span> <span className="hidden sm:inline">Ask the tutor</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-4 md:p-6 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md flex flex-col rounded-[28px] brutal-border bg-card brutal-shadow max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b-2 border-foreground/10 px-5 py-4">
              <div className="font-display font-extrabold">Tutor for this video</div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] break-words rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm"
                      : "max-w-[85%] break-words rounded-2xl bg-background border-2 border-foreground/10 px-4 py-2.5 text-sm"
                  }
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="border-t-2 border-foreground/10 p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {lesson.tutorSeed.slice(0, 2).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => ask(s.q)}
                    className="rounded-full border border-foreground/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground hover:text-background transition"
                  >
                    {s.q}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                }}
                className="flex items-center gap-2 rounded-2xl border-2 border-foreground/10 bg-background p-1.5 focus-within:border-foreground"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold"
                >
                  Ask
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
