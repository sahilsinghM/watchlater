import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Brand } from "@/components/Brand";
import { AttentionTimeline } from "@/components/AttentionTimeline";
import { YouTubeEmbed, type YouTubePlayerHandle } from "@/components/YouTubeEmbed";
import { ToneToggle } from "@/components/ToneToggle";
import { TutorPanel } from "@/components/TutorPanel";
import { ShareButton } from "@/components/ShareButton";
import { VerdictBadge } from "@/components/VerdictBadge";
import { languageLabel } from "@/lib/language";
import { WaitlistCard } from "@/components/WaitlistCard";
import { LessonHeroSkeleton } from "@/components/LessonSkeleton";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { getIngestStatus } from "@/lib/ingest.functions";
import { fmtRange, fmtTime, type Lesson, type Tone } from "@/lib/lessonSchema";

const SITE = "https://watchlater-sigma.vercel.app";

export const Route = createFileRoute("/lesson/$videoId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lessonQueryOptions(params.videoId)),
  head: () => ({
    meta: [{ title: "Lesson · WatchLater" }],
  }),
  // Cold loads get the layout-matched skeleton; cache hits resolve inside the
  // 150ms window so fast loads never flash it, and once shown it holds 300ms
  // so it never blinks out either.
  pendingComponent: LessonHeroSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  component: LessonHero,
});

function LessonHero() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [tone, setTone] = useState<Tone>("clear");
  const verdictLabel: Record<string, string> = {
    skip: "Skip it",
    lesson_only: "Do the lesson only",
    watch_core: "Watch the core section",
    watch_full: "Watch the full video",
  };

  // Poll for quiz completion when the lesson arrives in partial_ready state (quiz === null).
  // refetchInterval returns false to stop polling once phase is terminal or quiz already loaded.
  const statusQuery = useQuery({
    queryKey: ["ingest-status", videoId],
    queryFn: () => getIngestStatus({ data: { youtubeId: videoId } }),
    enabled: lesson.quiz === null,
    refetchInterval: (q) => {
      if (lesson.quiz !== null) return false;
      const phase = q.state.data?.phase;
      return phase === "ready" || phase === "failed" ? false : 2000;
    },
  });

  // When the secondary generation finishes (phase → ready), re-run the lesson
  // loader so useSuspenseQuery picks up the full lesson with quiz data.
  useEffect(() => {
    if (statusQuery.data?.phase === "ready") router.invalidate();
  }, [statusQuery.data?.phase, router]);

  // After 60 s with quiz still null, stop waiting and show a static fallback.
  const [quizUnavailable, setQuizUnavailable] = useState(false);
  useEffect(() => {
    if (lesson.quiz !== null) return;
    const id = setTimeout(() => setQuizUnavailable(true), 60_000);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <Brand />
        <div className="flex items-center gap-2">
          <span className="sm:hidden font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Tone
          </span>
          <ToneToggle value={tone} onChange={setTone} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 space-y-10">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Phones read top-to-bottom: eyebrow, clamped title, VERDICT, CTA —
              the product's answer in the first viewport. The summary card
              follows. Desktop keeps the original order via sm:order-*. */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="order-1 space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {lesson.video.channel} · {fmtTime(lesson.video.duration)}
                {lesson.video.language && !lesson.video.language.toLowerCase().startsWith("en")
                  ? ` · ${languageLabel(lesson.video.language)}`
                  : null}
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] line-clamp-2 sm:line-clamp-none">
                {lesson.video.title}
              </h1>
            </div>

            <VerdictBadge
              score={lesson.watchScore}
              difficulty={lesson.difficulty}
              verdict={lesson.watchVerdict}
              reason={lesson.scoreReason}
              className="order-2 sm:hidden"
            />

            <div className="order-4 sm:order-2 rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm space-y-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                This video in 30 seconds
              </div>
              <p className="text-lg leading-relaxed">{lesson.reallyAbout}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                <div className="rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold mb-1">
                    Best part · {fmtRange(lesson.bestPart.start, lesson.bestPart.end)}
                  </div>
                  <p className="text-sm">{lesson.bestPart.why}</p>
                </div>
                <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    Skip · {fmtRange(lesson.skipPart.start, lesson.skipPart.end)}
                  </div>
                  <p className="text-sm">{lesson.skipPart.why}</p>
                </div>
              </div>
            </div>

            <div className="order-3 flex flex-wrap items-center gap-3">
              <Link
                to="/lesson/$videoId/player"
                params={{ videoId }}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground brutal-border px-6 py-3.5 brutal-shadow font-display font-bold text-lg hover:-translate-y-0.5 hover:-translate-x-0.5 hover:[box-shadow:10px_10px_0_0_var(--foreground)] transition"
              >
                Start 5-minute lesson →
              </Link>
              <button
                type="button"
                onClick={() => playerRef.current?.seekTo(lesson.bestPart.start)}
                className="inline-flex items-center gap-2 rounded-2xl bg-card brutal-border px-5 py-3 font-bold hover:bg-foreground hover:text-background transition"
              >
                ▶ Watch the best part
              </button>
              <ShareButton
                path={`/lesson/${videoId}`}
                title={lesson.video.title}
                text="Learn this video in 5 minutes with WatchLater."
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <YouTubeEmbed ref={playerRef} videoId={lesson.video.youtubeId} />
            <VerdictBadge
              score={lesson.watchScore}
              difficulty={lesson.difficulty}
              verdict={lesson.watchVerdict}
              reason={lesson.scoreReason}
              className="hidden sm:flex"
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-2xl font-extrabold">Attention map</h2>
              <p className="text-sm text-muted-foreground">
                Click a segment to jump the video. Skip the muted parts, savour the bright ones.
              </p>
            </div>
          </div>
          <AttentionTimeline
            segments={lesson.segments}
            totalDuration={lesson.video.duration}
            onSeek={(s) => {
              playerRef.current?.seekTo(s);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        </section>

        <section className="rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
              Recommendation
            </div>
            {lesson.watchVerdict && (
              <span className="rounded-lg bg-secondary/30 border border-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest font-bold">
                {verdictLabel[lesson.watchVerdict]}
              </span>
            )}
          </div>
          <p className="text-lg font-medium">{lesson.recommendation}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/lesson/$videoId/player"
              params={{ videoId }}
              className="inline-flex items-center rounded-2xl bg-foreground text-background px-5 py-2.5 font-bold text-sm"
            >
              Start 5-minute lesson →
            </Link>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center rounded-2xl bg-card brutal-border px-5 py-2.5 font-bold text-sm hover:-translate-y-0.5 transition"
            >
              ← Try another video
            </button>
          </div>
        </section>

        <QuizSection videoId={videoId} lesson={lesson} quizUnavailable={quizUnavailable} />

        <WaitlistCard lessonVideoId={lesson.video.id} />
      </main>

      <TutorPanel lesson={lesson} />
    </div>
  );
}

function QuizSection({
  videoId,
  lesson,
  quizUnavailable,
}: {
  videoId: string;
  lesson: Lesson;
  quizUnavailable: boolean;
}) {
  if (lesson.quiz !== null) {
    return (
      <section className="rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm">
        <div className="font-mono text-[10px] uppercase tracking-widest text-secondary font-bold mb-3">
          Quiz
        </div>
        <p className="text-base text-muted-foreground mb-4">
          Test what you actually learned — 3 questions, no tricks.
        </p>
        <Link
          to="/lesson/$videoId/quiz"
          params={{ videoId }}
          className="inline-flex items-center rounded-2xl bg-secondary text-secondary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
        >
          Take the quiz →
        </Link>
      </section>
    );
  }

  if (quizUnavailable) {
    return (
      <section className="rounded-3xl brutal-border bg-card p-5 sm:p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
          Quiz unavailable
        </div>
        <p className="text-sm text-muted-foreground">
          The quiz could not be generated for this video.
        </p>
      </section>
    );
  }

  // Skeleton — quiz is being generated by the secondary Haiku call.
  return (
    <section className="rounded-3xl brutal-border bg-card p-5 sm:p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 animate-pulse">
        Quiz loading
      </div>
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-3/4 rounded-lg bg-foreground/10" />
        <div className="h-4 w-1/2 rounded-lg bg-foreground/10" />
        <div className="h-10 w-36 rounded-2xl bg-foreground/10 mt-5" />
      </div>
    </section>
  );
}
