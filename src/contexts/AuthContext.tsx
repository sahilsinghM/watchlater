import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import { AuthModal } from "@/components/AuthModal";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  requireAuth: (next: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function requireAuth(next: string) {
    if (session) {
      window.location.href = next;
      return;
    }
    setPendingNext(next);
  }

  async function signInWithGoogle(next?: string) {
    const sb = getSupabaseBrowser();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithGoogle, signOut, requireAuth }}>
      {children}
      {pendingNext !== null && (
        <AuthModal next={pendingNext} onDismiss={() => setPendingNext(null)} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
