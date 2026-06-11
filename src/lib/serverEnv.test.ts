import { describe, expect, test } from "bun:test";
import { parseServerEnv } from "./serverEnv";

// parseServerEnv is the single boundary between process.env and the app. It
// returns the typed config consumers already use (getServerConfig's shape) or
// throws naming the exact offending variable. Pure: takes an env dict.

const FULL_ENV = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  OPENROUTER_API_KEY: "sk-or-test",
  OPENAI_MODEL: "gpt-4.1-mini",
  ALLOW_PROTOTYPE_GENERATION: "true",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};

describe("parseServerEnv", () => {
  test("a complete production env parses into the typed config", () => {
    const config = parseServerEnv(FULL_ENV);
    expect(config.supabaseUrl).toBe("https://example.supabase.co");
    expect(config.supabaseSecretKey).toBe("sb_secret_test");
    expect(config.anthropicApiKey).toBe("sk-ant-test");
    expect(config.anthropicModel).toBe("claude-sonnet-4-6");
    expect(config.allowPrototypeGeneration).toBe(true);
    expect(config.isProduction).toBe(true);
  });
});

describe("production storage guard", () => {
  test("production without SUPABASE_SECRET_KEY throws naming the key", () => {
    const env = { ...FULL_ENV, SUPABASE_SECRET_KEY: undefined };
    expect(() => parseServerEnv(env)).toThrow(/SUPABASE_SECRET_KEY/);
  });

  test("production with an EMPTY SUPABASE_SECRET_KEY throws too (vercel env pull writes sensitive vars as empty strings)", () => {
    const env = { ...FULL_ENV, SUPABASE_SECRET_KEY: "" };
    expect(() => parseServerEnv(env)).toThrow(/SUPABASE_SECRET_KEY/);
  });

  test("production without SUPABASE_URL throws naming the key", () => {
    const env = { ...FULL_ENV, SUPABASE_URL: undefined };
    expect(() => parseServerEnv(env)).toThrow(/SUPABASE_URL/);
  });
});

describe("development behavior", () => {
  test("dev without any Supabase config parses fine (memory-store fallback stays possible)", () => {
    const config = parseServerEnv({ NODE_ENV: "development" });
    expect(config.isProduction).toBe(false);
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseSecretKey).toBeUndefined();
    expect(config.allowPrototypeGeneration).toBe(false);
  });

  test("a malformed SUPABASE_URL throws naming the variable", () => {
    const env = { ...FULL_ENV, SUPABASE_URL: "not-a-url" };
    expect(() => parseServerEnv(env)).toThrow(/SUPABASE_URL/);
  });
});

describe("generation key precedence", () => {
  test("OPENROUTER_API_KEY wins over OPENAI_API_KEY", () => {
    const config = parseServerEnv({
      OPENROUTER_API_KEY: "sk-or-1",
      OPENAI_API_KEY: "sk-oai-1",
    });
    expect(config.openaiApiKey).toBe("sk-or-1");
  });

  test("OPENAI_API_KEY is the fallback when OpenRouter is absent", () => {
    const config = parseServerEnv({ OPENAI_API_KEY: "sk-oai-1" });
    expect(config.openaiApiKey).toBe("sk-oai-1");
  });
});
