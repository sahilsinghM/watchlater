import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trackClick } from "@/lib/analytics";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Brand } from "@/components/Brand";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { getBrowserSessionKey } from "@/lib/anonymousSession";
import { submitQuizResult } from "@/lib/feedback.functions";

export const Route = createFileRoute("/lesson/$videoId_/quiz")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lessonQueryOptions(params.videoId)),
  head: () => ({ meta: [{ title: "Quiz · WatchLater" }] }),
  component: Quiz,
});

function Quiz() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  if (!lesson.quiz) {
    navigate({ to: "/lesson/$videoId", params: { videoId } });
    return null;
  }

  const q = lesson.quiz[idx];
  const total = lesson.quiz.length;

  async function submit() {
    if (picked === null) return;
    const next = [...answers, picked];
    setAnswers(next);
    setPicked(null);
    if (idx + 1 >= total) {
      const score = next.reduce((s, a, i) => s + (a === lesson.quiz![i].correctIndex ? 1 : 0), 0);
      try {
        await submitQuizResult({
          data: {
            lessonId: lesson.video.id,
            sessionKey: getBrowserSessionKey(),
            answers: next,
            score,
            total,
          },
        });
      } catch (error) {
        console.warn("[quiz] failed to persist result", error);
      }
      navigate({
        to: "/lesson/$videoId/done",
        params: { videoId },
        search: { score, total },
      });
    } else {
      setIdx((i) => i + 1);
    }
  }

  const revealed = picked !== null;
  const correct = picked === q.correctIndex;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 pb-2">
        <Brand size="sm" />
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-24 space-y-6">
        <div className="flex items-end justify-between px-1">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Question {idx + 1} / {total}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Quiz
          </span>
        </div>
        <div className="h-3 w-full bg-foreground/5 rounded-full overflow-hidden brutal-border">
          <div
            className="h-full bg-secondary transition-all duration-500"
            style={{ width: `${((idx + (revealed ? 1 : 0)) / total) * 100}%` }}
          />
        </div>

        <div className="rounded-[32px] brutal-border bg-card p-5 sm:p-8 brutal-shadow-sm space-y-6 animate-card-in">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold leading-tight">
            {q.prompt}
          </h2>
          <ul className="space-y-3">
            {q.options.map((opt, i) => {
              const isPicked = picked === i;
              const isCorrect = i === q.correctIndex;
              const state = !revealed
                ? isPicked
                  ? "border-foreground bg-primary/10"
                  : "border-foreground/15 hover:border-foreground hover:-translate-y-0.5 active:translate-y-0.5"
                : isCorrect
                  ? "border-accent bg-accent/15"
                  : isPicked
                    ? "border-destructive bg-destructive/10"
                    : "border-foreground/10 opacity-60";
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!revealed) {
                        trackClick("quiz_answer_selected", {
                          question_index: idx,
                          option_index: i,
                        });
                        setPicked(i);
                      }
                    }}
                    disabled={revealed}
                    className={
                      "flex w-full items-center gap-3 rounded-2xl border-[3px] bg-card px-5 py-4 text-left font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                      state
                    }
                  >
                    <span className="font-mono text-xs font-bold w-5 shrink-0 text-muted-foreground">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{opt}</span>
                    {revealed && isCorrect && <span>✓</span>}
                    {revealed && isPicked && !isCorrect && <span>✗</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {revealed && (
            <div
              className={
                "rounded-2xl border-2 border-dashed p-4 " +
                (correct ? "border-accent bg-accent/10" : "border-destructive bg-destructive/5")
              }
            >
              <div className="font-mono text-[10px] uppercase tracking-widest font-bold mb-1">
                {correct ? "Nice." : "Not quite."}
              </div>
              <p className="text-sm">{q.explanation}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!revealed) {
                if (picked === null) return;
              }
              trackClick(idx + 1 === total ? "quiz_finish" : "quiz_next_question", {
                question_index: idx,
              });
              submit();
            }}
            disabled={picked === null}
            className="w-full rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3.5 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {idx + 1 === total ? "Finish quiz →" : "Next question →"}
          </button>
        </div>
      </main>
    </div>
  );
}
