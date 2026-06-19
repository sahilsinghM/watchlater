import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAnonymousSession, recordFeedback, recordLead, recordQuizResult } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { sendWelcomeEmail } from "./email.server";
import { getSupabaseAdmin } from "./supabase-admin.server";

export const submitQuizResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().min(1),
        sessionKey: z.string().min(1),
        // Access token verified server-side; userId is never trusted from client.
        accessToken: z.string().optional(),
        answers: z.array(z.number().int().min(0)),
        score: z.number().int().min(0),
        total: z.number().int().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const store = getMvpStore();
    const session = await ensureAnonymousSession(store, data.sessionKey);
    // Verify access token server-side; derive userId from the verified token only.
    let verifiedUserId: string | undefined;
    if (data.accessToken) {
      const { data: authData } = await getSupabaseAdmin().auth.getUser(data.accessToken);
      verifiedUserId = authData.user?.id ?? undefined;
    }
    return recordQuizResult(store, {
      lessonId: data.lessonId,
      sessionId: session.id,
      userId: verifiedUserId,
      answers: data.answers,
      score: data.score,
      total: data.total,
    });
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().min(1),
        sessionKey: z.string().min(1),
        useful: z.boolean(),
        reason: z.string().max(500).optional(),
        name: z.string().max(120).optional(),
        email: z.string().email().max(254).optional(),
        source: z.enum(["completion", "lesson", "player"]).default("completion"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const store = getMvpStore();
    const session = await ensureAnonymousSession(store, data.sessionKey);
    return recordFeedback(store, {
      lessonId: data.lessonId,
      sessionId: session.id,
      useful: data.useful,
      reason: data.reason,
      name: data.name,
      email: data.email,
      source: data.source,
    });
  });

// Called at OAuth callback time for brand-new Google sign-ups.
// Email and new-user status are derived server-side from the verified access token;
// the client sends no PII and cannot target arbitrary email addresses.
export const onOAuthSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: authData } = await getSupabaseAdmin().auth.getUser(data.accessToken);
    const user = authData.user;
    if (!user?.email) return;
    // Server-side new-user guard: only send within 10 s of account creation.
    // Prevents repeat sends if the callback is somehow called twice.
    const ageSecs = (Date.now() - new Date(user.created_at).getTime()) / 1000;
    if (ageSecs > 10) return;
    try {
      await sendWelcomeEmail(user.email);
    } catch (err) {
      console.warn("[email] welcome email failed for new OAuth user", err);
    }
  });

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionKey: z.string().min(1),
        email: z.string().trim().email(),
        source: z.enum(["hero", "done"]),
        lessonVideoId: z.string().min(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const store = getMvpStore();
    const session = await ensureAnonymousSession(store, data.sessionKey);
    const { lead, isNew } = await recordLead(store, {
      sessionId: session.id,
      email: data.email,
      source: data.source,
      lessonVideoId: data.lessonVideoId,
    });
    // Only send on first capture — prevents repeat sends on re-submissions.
    // Awaited so Vercel doesn't kill the in-flight request before Resend fires.
    // try/catch ensures email failure never blocks lead capture.
    if (isNew) {
      try {
        await sendWelcomeEmail(data.email);
      } catch (err) {
        console.warn("[email] welcome email failed", err);
      }
    }
    return lead;
  });
