import { useEffect, useState } from "react";
import { captureLead, hasCapturedLead, isLikelyEmail } from "@/lib/lead";
import { trackClick } from "@/lib/analytics";

type Props = {
  lessonVideoId?: string;
};

type Status = "idle" | "saving" | "captured" | "error";

// Standalone early-access capture for the lesson hero. The done screen captures
// the same lead inline in its feedback card instead of using this component.
export function WaitlistCard({ lessonVideoId }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [invalid, setInvalid] = useState(false);

  // Read the dedup flag after mount so SSR (which always renders the form) and
  // the first client render agree, then flip to the confirmed state if needed.
  useEffect(() => {
    if (hasCapturedLead()) setStatus("captured");
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isLikelyEmail(email)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setStatus("saving");
    try {
      await captureLead({ email, source: "hero", lessonVideoId });
      setStatus("captured");
    } catch (error) {
      console.warn("[lead] failed to capture early-access email", error);
      setStatus("error");
    }
  }

  return (
    <section className="rounded-3xl brutal-border bg-card p-6 brutal-shadow-sm">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
        Early access
      </div>
      {status === "captured" ? (
        <p className="mt-2 font-display text-lg font-extrabold">
          <span className="text-accent">✓</span> You're on the early-access list.
        </p>
      ) : (
        <>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">
            WatchLater is in early access.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop your email and we'll let you in.
          </p>
          {/* Stacked on phones: side-by-side, flex-1 crushed the input to ~78px
              next to the Join button ("you@e..."). */}
          <form
            onSubmit={onSubmit}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
          >
            <div className="w-full sm:w-auto sm:min-w-0 sm:flex-1">
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (invalid) setInvalid(false);
                }}
                placeholder="you@example.com"
                aria-invalid={invalid}
                aria-label="Email address"
                className={`w-full rounded-2xl border-[3px] bg-background px-4 py-3 text-sm outline-none transition-colors ${
                  invalid ? "border-destructive" : "border-foreground/15 focus:border-foreground"
                }`}
                suppressHydrationWarning
              />
              {invalid && (
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive font-bold">
                  Enter a valid email
                </p>
              )}
              {status === "error" && (
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive font-bold">
                  Could not save — try again
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={status === "saving"}
              onClick={() => trackClick("hero_join_waitlist")}
              className="inline-flex w-full justify-center sm:w-auto items-center gap-2 rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm transition hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-50"
            >
              {status === "saving" ? "Joining…" : "Join early access →"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
