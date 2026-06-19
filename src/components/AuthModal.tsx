import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface AuthModalProps {
  videoId: string;
  onBack: () => void;
}

export function AuthModal({ videoId, onBack }: AuthModalProps) {
  function signIn() {
    const next = `/lesson/${videoId}/quiz`;
    getSupabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-sm rounded-[32px] brutal-border bg-card brutal-shadow p-6 sm:p-8 space-y-6 text-center animate-card-in">
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-extrabold">Take the quiz</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sign in to track your progress and build your learning library.
          </p>
        </div>
        <button
          type="button"
          onClick={signIn}
          className="w-full inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground brutal-border px-5 py-3.5 font-display font-bold brutal-shadow-sm hover:-translate-y-0.5 hover:-translate-x-0.5 transition"
        >
          Sign in with Google →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to lesson
        </button>
      </div>
    </div>
  );
}
