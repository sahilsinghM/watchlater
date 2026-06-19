import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import { getBrowserSessionKey } from "@/lib/anonymousSession";
import { linkAnonSessionToUser } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  useEffect(() => {
    const sb = getSupabaseBrowser();
    sb.auth.exchangeCodeForSession(window.location.search).then(async ({ data }) => {
      if (data.session?.user) {
        try {
          await linkAnonSessionToUser({
            data: {
              userId: data.session.user.id,
              sessionKey: getBrowserSessionKey(),
            },
          });
        } catch (e) {
          console.warn("[auth] failed to link anon session", e);
        }
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") ?? "/";
      window.location.href = next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">
        Signing you in…
      </p>
    </div>
  );
}
