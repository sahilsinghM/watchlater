import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { mascot } from "@/components/Brand";
import {
  requestLesson,
  getIngestStatus,
  parseIngestError,
  type IngestErrorCode,
} from "@/lib/ingest.functions";

export const Route = createFileRoute("/processing/$videoId")({
  head: () => ({
    meta: [{ title: "Building your lesson… · WatchLater" }],
  }),
  component: Processing,
});

const STEPS = [
  { key: "queued", label: "Lining up your video", quip: "Getting in the queue." },
  { key: "fetching_metadata", label: "Fetching video details", quip: "Saying hi to YouTube." },
  {
    key: "reading_transcript",
    label: "Reading the transcript",
    quip: "Watching the boring parts so you don't have to.",
  },
  {
    key: "reading_transcript",
    label: "Finding the key moments",
    quip: "Finding where the creator finally gets to the point.",
  },
  {
    key: "generating_lesson",
    label: "Analyzing key moments",
    quip: "Finding the timestamps worth jumping to.",
  },
  {
    key: "generating_lesson",
    label: "Building your interactive lesson",
    quip: "Stacking cards. Tuning the deck.",
  },
  { key: "ready", label: "Preparing your quiz", quip: "Making sure it's earned, not gifted." },
];

// If the worker stalls (e.g. it never picks the job up off the queue), the
// status poll would otherwise spin forever. Past this many seconds with no
// "ready", we stop waiting and show a recoverable error instead of hanging.
// Sized to outlast the server's worst case: the Vercel function gets 300s
// (multi-hour videos legitimately generate for several minutes — the server
// heartbeats the job while it works), plus buffer. Real failures surface much
// sooner via the failed-job status, not this backstop.
const TIMEOUT_SECONDS = 330;

function stepIndex(step: string): number {
  const i = STEPS.findIndex((s) => s.key === step);
  return i === -1 ? 0 : i;
}

// Most lessons land in well under a minute; we show this as the rough target
// so the wait has a frame of reference rather than feeling open-ended.
const ESTIMATE_SECONDS = 60;

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function Processing() {
  const navigate = useNavigate();
  const { videoId } = Route.useParams();
  const dispatched = useRef(false);

  // Tick a live "time elapsed" counter from the moment the screen mounts.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Kick off the ingest job once — idempotent (server checks for existing jobs)
  const dispatch = useMutation({
    mutationFn: () => requestLesson({ data: { youtubeId: videoId } }),
  });

  useEffect(() => {
    if (dispatched.current) return;
    dispatched.current = true;
    dispatch.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire exactly once on mount; dispatched ref guards re-entry
  }, []);

  // A "failed" status is only trustworthy once the dispatch POST has settled.
  // On a retry of a previously-failed video, the first polls race requestLesson
  // and see the OLD failed job — treating that as final showed its error copy
  // (and stopped polling) while the server was successfully rebuilding. Track
  // it in a ref so refetchInterval's closure always reads the current value.
  const dispatchSettled = dispatch.isSuccess || dispatch.isError;
  const dispatchSettledRef = useRef(dispatchSettled);
  dispatchSettledRef.current = dispatchSettled;
  const failedIsFinal = (phase?: string) => phase === "failed" && dispatchSettledRef.current;

  // Poll Supabase job status every 2 s until ready or definitively failed.
  // Polling runs WHILE the requestLesson POST is in flight — that POST stays
  // open for the whole inline build, so gating polls on it froze the UI on
  // step 1 and hid real errors behind the generic timeout.
  const statusQuery = useQuery({
    queryKey: ["ingest-status", videoId],
    queryFn: () => getIngestStatus({ data: { youtubeId: videoId } }),
    refetchInterval: (q) => {
      const phase = q.state.data?.phase;
      if (phase === "ready" || failedIsFinal(phase)) return false;
      return 2000;
    },
    enabled: true,
    retry: false,
  });

  // Navigate as soon as lesson is ready
  useEffect(() => {
    if (statusQuery.data?.phase === "ready") {
      const t = setTimeout(() => navigate({ to: "/lesson/$videoId", params: { videoId } }), 400);
      return () => clearTimeout(t);
    }
  }, [statusQuery.data?.phase, navigate, videoId]);

  // Show error state — but only once the dispatch has settled; before that a
  // failed status may belong to a previous attempt that is being retried.
  if (statusQuery.data?.phase === "failed" && dispatchSettled) {
    const { code, detail } = statusQuery.data;
    return <ErrorState code={code} detail={detail} />;
  }
  if (statusQuery.isError) {
    const { code, detail } = parseIngestError((statusQuery.error as Error).message);
    return <ErrorState code={code} detail={detail} />;
  }

  const currentStep = statusQuery.data?.phase === "processing" ? statusQuery.data.step : "queued";
  const isReady = statusQuery.data?.phase === "ready";

  // Guard against an indefinite hang: if we've waited past the timeout without
  // a lesson, surface a recoverable error rather than polling forever.
  if (!isReady && elapsed >= TIMEOUT_SECONDS) {
    return (
      <ErrorState
        code="TIMEOUT"
        detail={`No lesson after ${TIMEOUT_SECONDS}s (last step: ${currentStep})`}
      />
    );
  }

  const activeIdx = isReady ? STEPS.length : stepIndex(currentStep);
  const pct = Math.min(100, ((isReady ? STEPS.length : activeIdx + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 sm:px-6 py-12">
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
            Usually about a minute · multi-hour videos take a few
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="h-4 w-full bg-foreground/5 rounded-full overflow-hidden brutal-border">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-500 ease-[var(--ease-spring)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-widest">
            <span className="text-foreground">Elapsed · {fmtClock(elapsed)}</span>
            <span className="text-muted-foreground">Est. · ~{fmtClock(ESTIMATE_SECONDS)}</span>
          </div>
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
    body: "WatchLater needs a transcript to build a lesson. Try a video with subtitles enabled — most educational channels have them.",
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
    body: "WatchLater is tuned for long-form videos — anything from 5 minutes to 12 hours. Try a longer video.",
  },
  TOO_LONG: {
    title: "This video is too long",
    body: "WatchLater supports videos up to 12 hours. If your video is longer than that, we're impressed you were going to watch it.",
  },
  // Retired gate — only legacy failed job rows still carry this code. A retry
  // rebuilds the lesson: requestLesson treats a failed latest job as stale.
  NON_ENGLISH: {
    title: "This lesson was built before language support",
    body: "WatchLater now supports videos in any language. Paste the link again to rebuild this lesson.",
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
  TIMEOUT: {
    title: "This is taking longer than it should",
    body: "We couldn't build your lesson in time — the processor may be busy or temporarily down. Give it another go in a minute, or try a different video.",
  },
  UNKNOWN: {
    title: "Something went sideways",
    body: "YouTube didn't respond the way we expected. This is usually transient — try again or pick another video.",
  },
};

function ErrorState({ code, detail }: { code: IngestErrorCode; detail: string }) {
  const copy = ERROR_COPY[code] ?? ERROR_COPY.UNKNOWN;
  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 sm:px-6 py-12">
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
          <p className="mt-2 font-mono break-words">
            {code}: {detail}
          </p>
        </details>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {code === "TIMEOUT" && (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
            >
              Try again →
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center rounded-2xl bg-card brutal-border px-5 py-3 font-bold hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
          >
            ← Try another URL
          </Link>
        </div>
      </div>
    </div>
  );
}
