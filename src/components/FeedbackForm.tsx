type FeedbackState = "idle" | "saving" | "saved" | "error";

interface FeedbackFormProps {
  reason: string;
  name: string;
  email: string;
  emailError: string | null;
  feedbackState: FeedbackState;
  leadCaptured: boolean;
  onReasonChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onUseful: () => void;
  onNotUseful: () => void;
}

export function FeedbackForm({
  reason,
  name,
  email,
  emailError,
  feedbackState,
  leadCaptured,
  onReasonChange,
  onNameChange,
  onEmailChange,
  onUseful,
  onNotUseful,
}: FeedbackFormProps) {
  const saved = feedbackState === "saved";
  const saving = feedbackState === "saving";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="feedback-note"
          className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold"
        >
          Optional note
        </label>
        <textarea
          id="feedback-note"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Optional note"
          disabled={saved}
          className="min-h-20 w-full resize-none rounded-2xl brutal-border bg-background px-4 py-3 text-sm outline-none focus:ring-0 focus:shadow-[4px_4px_0_var(--foreground)] disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {leadCaptured ? "Early access" : "Want a reply or early access? Leave your details"}
        </div>

        {leadCaptured ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="feedback-name" className="sr-only">
                Your name (optional)
              </label>
              <input
                id="feedback-name"
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Your name (optional)"
                autoComplete="name"
                disabled={saved}
                className="w-full rounded-2xl brutal-border bg-background px-4 py-3 text-sm outline-none focus:ring-0 focus:shadow-[4px_4px_0_var(--foreground)] disabled:opacity-50"
              />
            </div>
            <p className="self-center font-display text-sm font-extrabold">
              <span className="text-accent">✓</span> You're on the early-access list.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="feedback-name" className="sr-only">
                  Your name (optional)
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  disabled={saved}
                  className="w-full rounded-2xl brutal-border bg-background px-4 py-3 text-sm outline-none focus:ring-0 focus:shadow-[4px_4px_0_var(--foreground)] disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="feedback-email" className="sr-only">
                  Email (optional)
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="you@email.com (optional)"
                  autoComplete="email"
                  disabled={saved}
                  className="w-full rounded-2xl brutal-border bg-background px-4 py-3 text-sm outline-none focus:ring-0 focus:shadow-[4px_4px_0_var(--foreground)] disabled:opacity-50"
                />
              </div>
            </div>
            {emailError && <p className="text-sm text-destructive font-medium">{emailError}</p>}
          </div>
        )}
      </div>

      {saved ? (
        <div className="rounded-2xl bg-accent/10 brutal-border p-3 font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
          ✓ Feedback received — thanks
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onUseful}
            disabled={saving}
            className="min-h-[44px] rounded-2xl bg-accent text-accent-foreground brutal-border px-5 py-3 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-x-0 active:translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            Useful ✓
          </button>
          <button
            type="button"
            onClick={onNotUseful}
            disabled={saving}
            className="min-h-[44px] rounded-2xl bg-card brutal-border px-5 py-3 font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 hover:bg-foreground hover:text-background active:translate-x-0 active:translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            Not useful ✗
          </button>
        </div>
      )}

      {feedbackState === "error" && (
        <p className="text-sm text-destructive font-medium">
          Something went wrong — please try again.
        </p>
      )}
    </div>
  );
}
