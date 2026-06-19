import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { trackClick, trackSectionVisible } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Brand } from "@/components/Brand";
import { LessonCardView } from "@/components/LessonCard";
import { YouTubeEmbed, type YouTubePlayerHandle } from "@/components/YouTubeEmbed";
import { ToneToggle } from "@/components/ToneToggle";
import { TutorPanel } from "@/components/TutorPanel";
import { LessonPlayerSkeleton } from "@/components/LessonSkeleton";
import { lessonQueryOptions } from "@/lib/lessonQuery";
import { fmtTime, type Tone } from "@/lib/lessonSchema";

export const Route = createFileRoute("/lesson/$videoId_/player")({
  validateSearch: z.object({ t: z.number().min(0).default(0) }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lessonQueryOptions(params.videoId)),
  head: () => ({ meta: [{ title: "Lesson · WatchLater" }] }),
  // Same flash guard as the hero route: skeleton only past 150ms, then holds.
  pendingComponent: LessonPlayerSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  component: Player,
});

function Player() {
  const { videoId } = Route.useParams();
  const { t: seekTo } = Route.useSearch();
  const navigate = useNavigate();
  const { data: lesson } = useSuspenseQuery(lessonQueryOptions(videoId));
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [tone, setTone] = useState<Tone>("clear");
  const { requireAuth } = useAuth();

  const card = lesson.cards[idx];
  const total = lesson.cards.length;
  const pct = Math.round(((idx + 1) / total) * 100);
  const displaySeconds = card.timestamp ?? (idx === 0 ? seekTo : undefined);

  useEffect(() => {
    trackSectionVisible("player_card", { card_index: idx, card_type: card.kind });
  }, [idx]);

  function next() {
    if (idx + 1 >= total) {
      requireAuth(`/lesson/${videoId}/quiz`);
      return;
    }
    trackClick("player_next_card", { card_index: idx + 1, card_type: lesson.cards[idx + 1]?.kind });
    setDir(1);
    setIdx((i) => i + 1);
  }
  function prev() {
    if (idx === 0) return;
    trackClick("player_prev_card", { card_index: idx - 1, card_type: lesson.cards[idx - 1]?.kind });
    setDir(-1);
    setIdx((i) => i - 1);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <Brand size="sm" />
        <ToneToggle
          value={tone}
          onChange={(t) => {
            setTone(t);
            trackClick("player_tone_toggle", { tone: t });
          }}
        />
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-32 sm:pb-24 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Card {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <span className="font-display font-extrabold text-primary text-sm">
              {pct}% complete
            </span>
          </div>
          <div className="h-3 w-full bg-foreground/5 rounded-full overflow-hidden brutal-border">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <LessonCardView
          card={card}
          tone={tone}
          direction={dir}
          onSeek={(s) => playerRef.current?.seekTo(s)}
        />

        {displaySeconds !== undefined && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-1">
              See it in the video · {fmtTime(displaySeconds)}
            </div>
            <YouTubeEmbed
              key={card.id}
              ref={playerRef}
              videoId={lesson.video.youtubeId}
              startSeconds={displaySeconds}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              emoji: "🤔",
              label: "Explain more",
              reaction: "explain_more" as const,
              className: "hover:bg-secondary",
            },
            { emoji: "✅", label: "Got it", reaction: "got_it" as const, primary: true },
            {
              emoji: "🥱",
              label: "Too basic",
              reaction: "too_basic" as const,
              className: "hover:bg-muted",
            },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => {
                trackClick("player_reaction", { reaction: b.reaction });
                next();
              }}
              className={
                "flex flex-col items-center justify-center gap-1.5 rounded-2xl brutal-border py-4 transition active:translate-y-0.5 " +
                (b.primary
                  ? "bg-accent text-accent-foreground brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5"
                  : "bg-card hover:bg-foreground hover:text-background")
              }
            >
              <span className="text-2xl">{b.emoji}</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{b.label}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="inline-flex min-h-[44px] items-center px-1 -mx-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
          >
            ← Previous
          </button>
          <Link
            to="/lesson/$videoId"
            params={{ videoId }}
            className="inline-flex min-h-[44px] items-center px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Exit lesson
          </Link>
          <button
            type="button"
            onClick={next}
            className="inline-flex min-h-[44px] items-center px-1 -mx-1 font-mono text-[10px] uppercase tracking-widest text-primary font-bold"
          >
            {idx + 1 === total ? "Quiz time →" : "Next →"}
          </button>
        </div>
      </main>

      <TutorPanel lesson={lesson} />
    </div>
  );
}
