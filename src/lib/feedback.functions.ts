import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAnonymousSession, recordFeedback, recordLead, recordQuizResult } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";
import { sendWelcomeEmail } from "./email.server";

export const submitQuizResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().min(1),
        sessionKey: z.string().min(1),
        answers: z.array(z.number().int().min(0)),
        score: z.number().int().min(0),
        total: z.number().int().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const store = getMvpStore();
    const session = await ensureAnonymousSession(store, data.sessionKey);
    return recordQuizResult(store, {
      lessonId: data.lessonId,
      sessionId: session.id,
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
    // Fire-and-forget: email failure must never block lead capture.
    if (isNew) {
      sendWelcomeEmail(data.email).catch((err) =>
        console.warn("[email] welcome email failed", err),
      );
    }
    return lead;
  });
