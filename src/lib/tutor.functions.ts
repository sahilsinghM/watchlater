import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMvpStore } from "./mvpRuntime.server";
import { getServerConfig } from "./config.server";
import OpenAIBase from "openai";
import { PostHogOpenAI } from "@posthog/ai/openai";
import { getPostHogServer } from "./posthogServer.server";

const OPENROUTER_HEADERS = {
  "http-referer": "https://watchlater-sigma.vercel.app",
  "x-title": "WatchLater",
};

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        youtubeId: z.string().min(1),
        question: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ answer: string }> => {
    const { youtubeId, question } = data;
    const config = getServerConfig();
    const apiKey = config.openaiApiKey;
    if (!apiKey) return { answer: "Tutor unavailable — no API key configured." };

    const store = getMvpStore();
    const lesson = await store.getLessonByYoutubeId(youtubeId);
    if (!lesson) return { answer: "I couldn't find this lesson. Try reloading the page." };

    const context = [
      `Video: "${lesson.video.title}" by ${lesson.video.channel}`,
      `What it's really about: ${lesson.reallyAbout}`,
      `Watch verdict: ${lesson.watchVerdict} — ${lesson.recommendation}`,
      `Watch score: ${lesson.watchScore}/10`,
      `Key concepts:\n${lesson.cards.map((c) => `- ${c.title}: ${c.body}`).join("\n")}`,
      lesson.tutorSeed?.length
        ? `Pre-answered questions:\n${lesson.tutorSeed.map((s) => `Q: ${s.q}\nA: ${s.a}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages: OpenAIBase.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a concise tutor for a specific YouTube video. Answer ONLY from the lesson context provided. " +
          "If the answer isn't in the context, say so honestly — don't make things up. " +
          "Keep answers under 3 sentences. No markdown.",
      },
      {
        role: "user",
        content: `Lesson context:\n${context}\n\nUser question: ${question}`,
      },
    ];

    const model = config.openaiModel ?? "meta-llama/llama-3.3-70b-instruct";
    const phClient = getPostHogServer();

    let answer: string;
    if (phClient) {
      const client = new PostHogOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: OPENROUTER_HEADERS,
        // .server.ts never runs in a browser; this flag silences the SDK's
        // environment check which false-positives in Bun's test runner.
        dangerouslyAllowBrowser: true,
        posthog: phClient,
      });
      const res = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 200,
        posthogDistinctId: youtubeId,
        posthogPrivacyMode: true,
      });
      answer = res.choices[0]?.message?.content ?? "";
    } else {
      const client = new OpenAIBase({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: OPENROUTER_HEADERS,
        // Same rationale as above — .server.ts + Bun test runner.
        dangerouslyAllowBrowser: true,
      });
      const res = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 200,
      });
      answer = res.choices[0]?.message?.content ?? "";
    }

    if (!answer) return { answer: "I couldn't come up with an answer. Try rephrasing." };
    return { answer: answer.trim() };
  });
