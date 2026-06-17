import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { trackClick } from "@/lib/analytics";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Brand, mascot } from "@/components/Brand";
import { ShareButton } from "@/components/ShareButton";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { fmtRange, fmtTime } from "@/lib/lessonSchema";
import { masteryResult } from "@/lib/mastery";
import { MasteryCelebration } from "@/components/MasteryCelebration";
import { getBrowserSessionKey } from "@/lib/anonymousSession";
import { submitFeedback } from "@/lib/feedback.functions";
import { captureLead, hasCapturedLead, isLikelyEmail } from "@/lib/lead";
import { FeedbackForm } from "@/components/FeedbackForm";

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
  const mastery = masteryResult(score, total);
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
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
          You moved through {fmtTime(lesson.video.duration)} of video in 5 minutes.
        </p>

        <div className="animate-card-in" style={{ animationDelay: "0ms" }}>
          <MasteryCelebration
            score={score}
            total={total}
            videoTitle={lesson.video.title}
            sharePath={`/lesson/${videoId}`}
          />
        </div>

        {mastery.tier === "low" && (
          <div
            className="rounded-[32px] brutal-border bg-secondary/10 p-5 sm:p-6 text-left space-y-4 brutal-shadow-sm animate-card-in"
            style={{ animationDelay: "100ms" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Worth another try
            </div>
            <p className="font-display text-xl font-extrabold">
              You got {score}/{total}. Want to try again?
            </p>
            <Link
              to="/lesson/$videoId/quiz"
              params={{ videoId }}
              onClick={() => trackClick("done_try_again")}
              className="inline-flex items-center min-h-[44px] rounded-2xl bg-secondary text-secondary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-x-0 active:translate-y-0.5 transition"
            >
              Try the quiz again →
            </Link>
          </div>
        )}

        <div
          className="rounded-3xl brutal-border bg-card p-5 sm:p-6 text-left space-y-3 brutal-shadow-sm animate-card-in"
          style={{ animationDelay: "200ms" }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            If you want more
          </div>
          <p className="text-base">
            Watch{" "}
            <Link
              to="/lesson/$videoId/player"
              params={{ videoId }}
              search={{ t: lesson.bestPart.start }}
              className="font-bold underline decoration-primary hover:text-primary transition"
            >
              {fmtRange(lesson.bestPart.start, lesson.bestPart.end)}
            </Link>{" "}
            in the video. That's the section where the argument really lands.
          </p>
        </div>

        <div
          className="rounded-3xl brutal-border bg-card p-5 sm:p-6 text-left space-y-4 brutal-shadow-sm animate-card-in"
          style={{ animationDelay: "300ms" }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Was this useful?
          </div>
          <FeedbackForm
            reason={reason}
            name={name}
            email={email}
            emailError={emailError}
            feedbackState={feedbackState}
            leadCaptured={leadCaptured}
            onReasonChange={setReason}
            onNameChange={setName}
            onEmailChange={(v) => {
              setEmail(v);
              if (emailError) setEmailError(null);
            }}
            onUseful={() => {
              trackClick("done_feedback_useful");
              leaveFeedback(true);
            }}
            onNotUseful={() => {
              trackClick("done_feedback_not_useful");
              leaveFeedback(false);
            }}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <ShareButton
            path={`/lesson/${videoId}`}
            title={lesson.video.title}
            text="Learn this video in 5 minutes with WatchLater."
            className="text-sm"
            onClick={() => trackClick("done_share")}
          />
          <Link
            to="/lesson/$videoId"
            params={{ videoId }}
            className="inline-flex items-center min-h-[44px] rounded-2xl bg-card brutal-border px-5 py-3 font-bold text-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
          >
            ← Back to lesson hero
          </Link>
          <Link
            to="/"
            onClick={() => trackClick("done_process_another")}
            className="inline-flex items-center min-h-[44px] rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
          >
            Process another video →
          </Link>
        </div>
      </main>
    </div>
  );
}
