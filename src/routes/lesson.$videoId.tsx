import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Brand } from "@/components/Brand";
import { WatchScoreDial } from "@/components/WatchScoreDial";
import { AttentionTimeline } from "@/components/AttentionTimeline";
import { YouTubeEmbed, type YouTubePlayerHandle } from "@/components/YouTubeEmbed";
import { ToneToggle } from "@/components/ToneToggle";
import { TutorPanel } from "@/components/TutorPanel";
import { ShareButton } from "@/components/ShareButton";
import { WaitlistCard } from "@/components/WaitlistCard";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { fmtRange, fmtTime, type Tone } from "@/lib/lessonSchema";

export const Route = createFileRoute("/lesson/$videoId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lessonQueryOptions(params.videoId)),
  head: () => ({
    meta: [{ title: "Lesson · WatchLater" }],
  }),
  component: LessonHero,
});

function LessonHero() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [tone, setTone] = useState<Tone>("clear");
  const verdictLabel: Record<string, string> = {
    skip: "Skip it",
    lesson_only: "Do the lesson only",
    watch_core: "Watch the core section",
    watch_full: "Watch the full video",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <Brand />
        <div className="hidden md:block">
          <ToneToggle value={tone} onChange={setTone} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 space-y-10">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <div className="space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {lesson.video.channel} · {fmtTime(lesson.video.duration)}
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05]">
                {lesson.video.title}
              </h1>
            </div>

            <div className="rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm space-y-4">
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

            <div className="flex flex-wrap items-center gap-3">
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
                text="Learn this video in 5 minutes with VideoSense."
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <YouTubeEmbed ref={playerRef} videoId={lesson.video.youtubeId} />
            <div className="rounded-3xl brutal-border bg-card p-5 flex items-center gap-5 brutal-shadow-sm">
              <WatchScoreDial score={lesson.watchScore} />
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Watch Score
                </div>
                <div className="font-display text-lg font-extrabold leading-tight">
                  {lesson.difficulty} · Worth your time
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  {lesson.scoreReason}
                </p>
              </div>
            </div>
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
            <div className="md:hidden">
              <ToneToggle value={tone} onChange={setTone} />
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
              Start the lesson
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

        <WaitlistCard lessonVideoId={lesson.video.id} />
      </main>

      <TutorPanel lesson={lesson} />
    </div>
  );
}
