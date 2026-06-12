import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Brand, mascot } from "@/components/Brand";
import { ShareButton } from "@/components/ShareButton";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { fmtRange } from "@/lib/lessonSchema";
import { getBrowserSessionKey } from "@/lib/anonymousSession";
import { submitFeedback } from "@/lib/feedback.functions";
import { captureLead, hasCapturedLead, isLikelyEmail } from "@/lib/lead";

const search = z.object({
  score: z.number().int().min(0).default(0),
  total: z.number().int().min(1).default(3),
});

export const Route = createFileRoute("/lesson/$videoId_/done")({
  validateSearch: search,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lessonQueryOptions(params.videoId)),
  head: () => ({ meta: [{ title: "Lesson complete · WatchLater" }] }),
  component: Done,
});

function Done() {
  const { videoId } = Route.useParams();
  const { score, total } = Route.useSearch();
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
  const pct = Math.round((score / total) * 100);
  const label = pct >= 80 ? "Mastered" : pct >= 50 ? "Solid grasp" : "Worth a re-read";
  const [feedbackState, setFeedbackState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);

  // Reflect the shared dedup flag after mount (SSR always renders the input).
  useEffect(() => {
    if (hasCapturedLead()) setLeadCaptured(true);
  }, []);

  async function leaveFeedback(useful: boolean) {
    const trimmedEmail = email.trim();
    const emailValid = trimmedEmail !== "" && isLikelyEmail(trimmedEmail);
    // A bad email is flagged inline but must NOT block feedback — we just submit
    // feedback without it. Only a valid email rides along + becomes a lead.
    setEmailError(trimmedEmail && !emailValid ? "That email doesn't look right." : null);
    setFeedbackState("saving");
    try {
      await submitFeedback({
        data: {
          lessonId: lesson.video.id,
          sessionKey: getBrowserSessionKey(),
          useful,
          reason: reason.trim() || undefined,
          name: name.trim() || undefined,
          email: emailValid ? trimmedEmail : undefined,
          source: "completion",
        },
      });
      setFeedbackState("saved");
      // Additionally record the early-access lead. Never blocks or fails the
      // feedback the user already gave — fire it after, swallow errors.
      if (emailValid && !leadCaptured) {
        captureLead({ email: trimmedEmail, source: "done", lessonVideoId: lesson.video.id })
          .then(() => setLeadCaptured(true))
          .catch((error) => console.warn("[lead] failed to capture early-access email", error));
      }
    } catch (error) {
      console.warn("[feedback] failed to persist feedback", error);
      setFeedbackState("error");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 pb-2">
        <Brand size="sm" />
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-24 space-y-8 text-center">
        <div className="flex justify-center pt-6">
          <img src={mascot} alt="" width={160} height={160} className="h-32 w-32 animate-pop-in" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
          Lesson complete.
        </h1>
        <p className="text-muted-foreground">
          You moved through a {Math.floor(lesson.video.duration / 60)}-minute video in 5 minutes.
        </p>

        <div className="rounded-[32px] brutal-border bg-card p-5 sm:p-8 brutal-shadow space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Mastery
          </div>
          <div className="font-display text-6xl font-extrabold text-primary">{pct}%</div>
          <div className="font-display text-lg font-bold">{label}</div>
          <p className="text-sm text-muted-foreground">
            You got {score} of {total} correct.
          </p>
        </div>

        <div className="rounded-3xl brutal-border bg-card p-5 sm:p-6 text-left space-y-3 brutal-shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            If you want more
          </div>
          <p className="text-base">
            Watch{" "}
            <span className="font-bold">
              {fmtRange(lesson.bestPart.start, lesson.bestPart.end)}
            </span>{" "}
            in the video. That's the section where the argument really lands.
          </p>
        </div>

        <div className="rounded-3xl brutal-border bg-card p-5 sm:p-6 text-left space-y-4 brutal-shadow-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Was this useful?
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional note"
            className="min-h-20 w-full resize-none rounded-2xl border-2 border-foreground/15 bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
          />
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              {leadCaptured ? "Early access" : "Want a reply or early access? Leave your details"}
            </div>
            {leadCaptured ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  className="w-full rounded-2xl border-2 border-foreground/15 bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
                />
                <p className="self-center font-display text-sm font-extrabold">
                  <span className="text-accent">✓</span> You're on the early-access list.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name (optional)"
                    autoComplete="name"
                    className="w-full rounded-2xl border-2 border-foreground/15 bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="you@email.com (optional)"
                    autoComplete="email"
                    className="w-full rounded-2xl border-2 border-foreground/15 bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
                  />
                </div>
                {emailError && <p className="text-sm text-destructive font-medium">{emailError}</p>}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => leaveFeedback(true)}
              disabled={feedbackState === "saving" || feedbackState === "saved"}
              className="rounded-2xl bg-accent text-accent-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm disabled:opacity-50"
            >
              Useful
            </button>
            <button
              type="button"
              onClick={() => leaveFeedback(false)}
              disabled={feedbackState === "saving" || feedbackState === "saved"}
              className="rounded-2xl bg-card brutal-border px-5 py-3 font-bold disabled:opacity-50"
            >
              Not useful
            </button>
            {feedbackState === "saved" && (
              <span className="self-center font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
                Saved
              </span>
            )}
            {feedbackState === "error" && (
              <span className="self-center font-mono text-[10px] uppercase tracking-widest text-destructive font-bold">
                Could not save
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <ShareButton
            path={`/lesson/${videoId}`}
            title={lesson.video.title}
            text="Learn this video in 5 minutes with VideoSense."
            className="text-sm"
          />
          <Link
            to="/lesson/$videoId"
            params={{ videoId }}
            className="inline-flex items-center rounded-2xl bg-card brutal-border px-5 py-3 font-bold text-sm hover:-translate-y-0.5 transition"
          >
            ← Back to lesson hero
          </Link>
          <Link
            to="/"
            className="inline-flex items-center rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
          >
            Process another video →
          </Link>
        </div>
      </main>
    </div>
  );
}
