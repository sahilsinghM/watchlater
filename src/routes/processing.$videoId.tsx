import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { mascot } from "@/components/Brand";
import { requestLesson, getIngestStatus, parseIngestError, type IngestErrorCode } from "@/lib/ingest.functions";

export const Route = createFileRoute("/processing/$videoId")({
  head: () => ({
    meta: [{ title: "Building your lesson… · VideoSense" }],
  }),
  component: Processing,
});

const STEPS = [
  { key: "queued",             label: "Fetching video details",           quip: "Saying hi to YouTube." },
  { key: "fetching_metadata",  label: "Fetching video details",           quip: "Saying hi to YouTube." },
  { key: "reading_transcript", label: "Reading the transcript",           quip: "Watching the boring parts so you don't have to." },
  { key: "reading_transcript", label: "Finding the key moments",          quip: "Finding where the creator finally gets to the point." },
  { key: "generating_lesson",  label: "Analyzing key moments",            quip: "Finding the timestamps worth jumping to." },
  { key: "generating_lesson",  label: "Building your interactive lesson", quip: "Stacking cards. Tuning the deck." },
  { key: "ready",              label: "Preparing your quiz",              quip: "Making sure it's earned, not gifted." },
];

function stepIndex(step: string): number {
  const i = STEPS.findIndex((s) => s.key === step);
  return i === -1 ? 0 : i;
}

function Processing() {
  const navigate = useNavigate();
  const { videoId } = Route.useParams();
  const dispatched = useRef(false);

  // Kick off the ingest job once — idempotent (server checks for existing jobs)
  const dispatch = useMutation({
    mutationFn: () => requestLesson({ data: { youtubeId: videoId } }),
  });

  useEffect(() => {
    if (dispatched.current) return;
    dispatched.current = true;
    dispatch.mutate();
  }, []);

  // Poll Supabase job status every 2 s until ready or failed
  const statusQuery = useQuery({
    queryKey: ["ingest-status", videoId],
    queryFn: () => getIngestStatus({ data: { youtubeId: videoId } }),
    refetchInterval: (q) => {
      const phase = q.state.data?.phase;
      if (phase === "ready" || phase === "failed") return false;
      return 2000;
    },
    enabled: dispatch.isSuccess || dispatch.isError,
    retry: false,
  });

  // Navigate as soon as lesson is ready
  useEffect(() => {
    if (statusQuery.data?.phase === "ready") {
      const t = setTimeout(
        () => navigate({ to: "/lesson/$videoId", params: { videoId } }),
        400,
      );
      return () => clearTimeout(t);
    }
  }, [statusQuery.data?.phase, navigate, videoId]);

  // Show error state
  if (statusQuery.data?.phase === "failed") {
    const { code, detail } = statusQuery.data;
    return <ErrorState code={code} detail={detail} />;
  }
  if (statusQuery.isError) {
    const { code, detail } = parseIngestError((statusQuery.error as Error).message);
    return <ErrorState code={code} detail={detail} />;
  }

  const currentStep = statusQuery.data?.phase === "processing" ? statusQuery.data.step : "queued";
  const isReady = statusQuery.data?.phase === "ready";
  const activeIdx = isReady ? STEPS.length : stepIndex(currentStep);
  const pct = Math.min(100, ((isReady ? STEPS.length : activeIdx + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background grid place-items-center px-6 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="flex flex-col items-center gap-4">
          <img
            src={mascot}
            alt=""
            width={120}
            height={120}
            className="h-24 w-24 object-contain animate-float"
          />
          <h1 className="font-display text-3xl font-extrabold text-center">
            Building your lesson…
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            This usually takes a moment
          </p>
        </div>

        <div className="h-4 w-full bg-foreground/5 rounded-full overflow-hidden brutal-border">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>

        <ul className="space-y-2">
          {STEPS.map((s, i) => {
            const done = isReady || i < activeIdx;
            const active = !isReady && i === activeIdx;
            return (
              <li
                key={`${s.key}-${i}`}
                className={
                  "flex items-start gap-3 rounded-2xl border-2 px-4 py-3 transition " +
                  (done
                    ? "border-foreground/10 bg-card opacity-70"
                    : active
                    ? "border-foreground bg-card brutal-shadow-sm"
                    : "border-foreground/10 bg-card/60 opacity-50")
                }
              >
                <span
                  className={
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold " +
                    (done
                      ? "bg-accent text-accent-foreground"
                      : active
                      ? "bg-primary text-primary-foreground animate-pulse"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold leading-tight">{s.label}</div>
                  {active && (
                    <div className="text-xs italic text-muted-foreground mt-0.5">{s.quip}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const ERROR_COPY: Record<IngestErrorCode, { title: string; body: string }> = {
  NO_CAPTIONS: {
    title: "This video has no captions",
    body: "VideoSense needs a transcript to build a lesson. Try a video with subtitles enabled — most educational channels have them.",
  },
  PRIVATE_OR_BLOCKED: {
    title: "This video isn't available",
    body: "It might be private, age-restricted, or blocked from embedding. Try a different public video.",
  },
  NOT_FOUND: {
    title: "Video not found",
    body: "Double-check the URL — that video ID doesn't seem to exist.",
  },
  TOO_SHORT: {
    title: "This video is too short",
    body: "VideoSense MVP is tuned for long-form videos between 5 and 90 minutes. Try a longer video.",
  },
  TOO_LONG: {
    title: "This video is too long",
    body: "VideoSense MVP supports videos up to 90 minutes. Try a shorter video with a focused transcript.",
  },
  NON_ENGLISH: {
    title: "This video is not English",
    body: "The MVP only supports English videos with usable English transcripts.",
  },
  TRANSCRIPT_TOO_SPARSE: {
    title: "The transcript is too thin",
    body: "There isn't enough caption coverage to build a trustworthy lesson from this video.",
  },
  TRANSCRIPT_TOO_NOISY: {
    title: "The transcript is too noisy",
    body: "The captions look too repetitive or unreliable to ground a lesson.",
  },
  GENERATION_FAILURE: {
    title: "Lesson generation failed",
    body: "The source data was available, but we could not generate a valid lesson from it. Try again or choose another video.",
  },
  GENERATION_SCHEMA_INVALID: {
    title: "Lesson generation failed",
    body: "The generated lesson did not pass validation, so we are not showing it as trustworthy.",
  },
  UNKNOWN: {
    title: "Something went sideways",
    body: "YouTube didn't respond the way we expected. This is usually transient — try again or pick another video.",
  },
};

function ErrorState({ code, detail }: { code: IngestErrorCode; detail: string }) {
  const copy = ERROR_COPY[code] ?? ERROR_COPY.UNKNOWN;
  return (
    <div className="min-h-screen bg-background grid place-items-center px-6 py-12">
      <div className="w-full max-w-xl space-y-6 text-center">
        <div className="flex justify-center">
          <img
            src={mascot}
            alt=""
            width={120}
            height={120}
            className="h-24 w-24 object-contain grayscale opacity-80"
          />
        </div>
        <h1 className="font-display text-3xl font-extrabold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.body}</p>
        <details className="rounded-2xl brutal-border bg-card p-4 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-mono uppercase tracking-widest">Details</summary>
          <p className="mt-2 font-mono break-words">{code}: {detail}</p>
        </details>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
          >
            ← Try another URL
          </Link>
        </div>
      </div>
    </div>
  );
}
