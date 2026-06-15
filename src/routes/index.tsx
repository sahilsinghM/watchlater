import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Brand, mascot } from "@/components/Brand";
import { validateVideoInput } from "@/lib/mvpFlow";
import { trackClick } from "@/lib/analytics";
import { useTrackVisible } from "@/hooks/useTrackVisible";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WatchLater — Understand any long video in 5 minutes" },
      {
        name: "description",
        content:
          "Paste a YouTube URL. Get an interactive 5-minute lesson with cards, a timeline, and a quiz.",
      },
      { property: "og:title", content: "WatchLater — Long videos, learned fast" },
      {
        property: "og:description",
        content: "Turn long YouTube videos into playful, interactive 5-minute lessons.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const heroRef = useRef<HTMLElement>(null);
  const whatRef = useRef<HTMLElement>(null);
  const howRef = useRef<HTMLElement>(null);
  useTrackVisible(heroRef, "landing_hero");
  useTrackVisible(whatRef, "landing_what");
  useTrackVisible(howRef, "landing_how");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube URL to get started.");
      return;
    }
    const validation =
      trimmed.toLowerCase() === "sample"
        ? ({ ok: true, youtubeId: "sample" } as const)
        : validateVideoInput(trimmed);
    if (!validation.ok) {
      setError(
        validation.code === "SHORTS_UNSUPPORTED"
          ? "YouTube Shorts are not supported yet. Paste a regular long-form video."
          : "That doesn't look like a YouTube link. Try a youtube.com/watch?v=… or youtu.be/… URL.",
      );
      return;
    }
    navigate({ to: "/processing/$videoId", params: { videoId: validation.youtubeId } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 flex items-center justify-between">
        <Brand />
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#how" className="flex items-center py-3 hover:text-foreground transition">
            How it works
          </a>
          <a href="#what" className="flex items-center py-3 hover:text-foreground transition">
            What you get
          </a>
        </nav>
      </header>

      <main ref={heroRef} className="mx-auto max-w-4xl px-4 sm:px-6 pt-16 pb-24 text-center space-y-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-mono font-bold tracking-wider uppercase">
          <span className="size-2 bg-primary rounded-full animate-pulse" />
          Built for busy learners
        </div>

        <h1 className="vs-h1 text-balance">
          Understand any long video <span className="text-primary italic">in 5 minutes.</span>
        </h1>

        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Paste a YouTube link. We'll watch the boring parts so you don't have to — and hand you
          back a playful, interactive lesson with cards, a timeline, and a quick quiz.
        </p>

        <form onSubmit={submit} className="relative mx-auto max-w-2xl group">
          <div className="absolute -inset-1 bg-primary/10 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative flex flex-col sm:flex-row items-stretch gap-2 sm:gap-0 sm:items-center p-2 bg-card brutal-border rounded-[28px] brutal-shadow hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:10px_10px_0_0_var(--foreground)] transition-all">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              className="flex-1 px-5 py-3 bg-transparent border-none outline-none font-medium text-base sm:text-lg placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              onClick={() => trackClick("landing_generate_cta")}
              className="px-6 py-3 bg-primary text-primary-foreground font-display font-bold text-base sm:text-lg rounded-2xl cursor-pointer hover:brightness-110 active:translate-y-1 transition-all"
            >
              Generate lesson →
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive font-medium">{error}</p>}
          {import.meta.env.DEV && (
            <p className="mt-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
              Dev demo: paste <span className="text-foreground">sample</span> to skip ingestion
            </p>
          )}
        </form>

        <div className="flex justify-center pt-4">
          <div className="relative animate-float">
            <img
              src={mascot}
              alt="WatchLater mascot"
              width={160}
              height={160}
              className="h-32 w-32 object-contain drop-shadow-[6px_6px_0_rgba(0,0,0,0.12)]"
            />
            <div className="absolute -bottom-1 -right-3 px-3 py-1 bg-card brutal-border text-[10px] font-bold rounded-lg brutal-shadow-sm">
              I'm ready!
            </div>
          </div>
        </div>
      </main>

      <section id="what" ref={whatRef} className="mx-auto max-w-5xl px-4 sm:px-6 pb-20">
        <h2 className="font-display text-2xl font-extrabold text-center mb-8">
          What you get from every video
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            {
              title: "Visual timeline",
              body: "See the video as colour-coded segments: skip, watch, core, demo.",
              swatch: (
                <div className="flex h-12 w-full overflow-hidden rounded-lg brutal-border">
                  <div className="h-full bg-muted" style={{ width: "20%" }} />
                  <div
                    className="h-full bg-primary/30 border-l-[3px] border-foreground"
                    style={{ width: "25%" }}
                  />
                  <div
                    className="h-full bg-secondary border-l-[3px] border-foreground"
                    style={{ width: "30%" }}
                  />
                  <div
                    className="h-full bg-accent border-l-[3px] border-foreground"
                    style={{ width: "15%" }}
                  />
                  <div
                    className="h-full bg-muted border-l-[3px] border-foreground"
                    style={{ width: "10%" }}
                  />
                </div>
              ),
            },
            {
              title: "Lesson cards",
              body: "Six tappable cards: concepts, analogies, the best quotes, and a recap.",
              swatch: (
                <div className="relative h-12">
                  <div className="absolute inset-x-4 top-0 h-12 rounded-lg bg-secondary brutal-border translate-x-2 translate-y-1" />
                  <div className="absolute inset-x-4 top-0 h-12 rounded-lg bg-card brutal-border grid place-items-center font-mono text-[10px] font-bold">
                    CARD 03 / 06
                  </div>
                </div>
              ),
            },
            {
              title: "Quick quiz",
              body: "Three questions to prove you actually got it — with a mastery score.",
              swatch: (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-12 rounded-lg brutal-border bg-accent/30 grid place-items-center text-lg">
                    ✓
                  </div>
                  <div className="h-12 rounded-lg brutal-border bg-card grid place-items-center text-muted-foreground">
                    ?
                  </div>
                  <div className="h-12 rounded-lg brutal-border bg-card grid place-items-center text-muted-foreground">
                    ?
                  </div>
                </div>
              ),
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-3xl brutal-border bg-card p-5 space-y-3 brutal-shadow-sm"
            >
              {f.swatch}
              <h3 className="font-display text-lg font-extrabold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" ref={howRef} className="mx-auto max-w-3xl px-4 sm:px-6 pb-24">
        <h2 className="font-display text-2xl font-extrabold text-center mb-8">How it works</h2>
        <ol className="space-y-3">
          {[
            "Paste any public YouTube URL",
            "We pull the transcript and find the parts that actually matter",
            "You get a 5-minute interactive lesson + a 3-question quiz",
          ].map((step, i) => (
            <li
              key={i}
              className="flex items-center gap-4 rounded-2xl brutal-border bg-card px-5 py-4"
            >
              <span className="font-display font-extrabold text-2xl text-primary w-8">{i + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t-2 border-foreground/10 py-8 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
        WatchLater · A learning playground
      </footer>
    </div>
  );
}
