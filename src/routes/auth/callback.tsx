import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { onOAuthSignIn } from "@/lib/feedback.functions";

const searchSchema = z.object({
  code: z.string().optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  component: OAuthCallback,
});

function validateNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function isNewUser(createdAt: string, lastSignInAt: string): boolean {
  return (
    createdAt === lastSignInAt ||
    Math.abs(new Date(createdAt).getTime() - new Date(lastSignInAt).getTime()) < 5000
  );
}

function OAuthCallback() {
  const { code, next } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      navigate({ to: "/" });
      return;
    }
    getSupabaseBrowser()
      .auth.exchangeCodeForSession(code)
      .then(async ({ data, error: exchangeError }) => {
        if (exchangeError || !data.session) {
          setError("Sign-in failed. Go back and try again.");
          return;
        }
        const { user, access_token } = data.session;
        if (isNewUser(user.created_at, user.last_sign_in_at ?? user.created_at)) {
          try {
            await onOAuthSignIn({ data: { accessToken: access_token } });
          } catch (err) {
            console.warn("[auth] welcome email failed", err);
          }
        }
        navigate({ to: validateNext(next) });
      })
      .catch(() => setError("Sign-in failed. Go back and try again."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-[32px] brutal-border bg-card brutal-shadow p-6 text-center space-y-4">
          <p className="font-display text-xl font-extrabold">{error}</p>
          <a href="/" className="text-primary text-sm underline">
            ← Back to WatchLater
          </a>
        </div>
      </div>
    );
  }

  return null;
}
