import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAnonymousSession, recordFeedback, recordQuizResult } from "./mvpFlow";
import { getMvpStore } from "./mvpRuntime.server";

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
