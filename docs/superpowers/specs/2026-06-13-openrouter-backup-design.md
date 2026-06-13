# OpenRouter reliable backup — design spec

**Date:** 2026-06-13
**Scope:** Make the existing OpenRouter/open-source fallback path production-reliable when Anthropic credits run out.

## Problem

The OpenRouter fallback in `openaiLesson.server.ts` has two problems that make it unreliable:

1. **45k char transcript budget** cuts off videos longer than ~45 minutes, producing truncated or invented lesson content.
2. **Default model `gpt-4.1-mini`** is a proprietary OpenAI model — not open source, and still costs OpenAI credits. Users switching away from Anthropic to avoid credit costs would still be paying a proprietary provider.

## Solution

Two targeted fixes to `openaiLesson.server.ts`:

1. **Raise `transcriptExcerpt` budget: 45,000 → 150,000 chars.** This covers ~2.5 hours of speech. At ~4 chars/token that is ~37,500 tokens, which fits comfortably in Llama 3.3 70b's 128k context window alongside the prompt (~3k tokens) and the 15k-token response budget.

2. **Change default model: `gpt-4.1-mini` → `meta-llama/llama-3.3-70b-instruct`.** Llama 3.3 70b is open source (Meta), available on OpenRouter, produces reliable structured JSON output, and costs ~$0.10–0.15 per 2-hour video. Users can still override via the `OPENAI_MODEL` env var.

## What does NOT change

- Single-call architecture (no Sonnet+Haiku parallel split)
- Full lesson generated in one shot — quiz and keyMoments are included, so the lesson page shows complete content on arrival with no quiz skeleton or polling
- No env var additions, no schema changes, no UI changes
- No changes to the Anthropic path

## Activation

Set `OPENROUTER_API_KEY` in Vercel environment variables (leave `ANTHROPIC_API_KEY` unset or remove it). The pipeline falls through automatically: Anthropic → OpenRouter → templated. Optionally set `OPENAI_MODEL` to override the default.

## Testing

The existing `processLesson.server.test.ts` covers the OpenRouter path via the `openaiApiKey` scenario. No new tests needed — the change is purely a constant and a string literal.
