import { z } from "zod";

// The single boundary between the environment and the app. Every variable the
// server reads is declared here — this schema IS the documentation of the
// deployment surface. parseServerEnv either returns the typed config or throws
// an error naming the exact offending variable; nothing else in the codebase
// reads process.env for server config.
//
// Empty strings are treated as missing: `vercel env pull` writes sensitive
// vars as "" and a blank dashboard field saves as "" — both bit us on
// 2026-06-11 when production silently fell back to the in-memory store.

const nonEmpty = z
  .string()
  .transform((s) => (s.trim() === "" ? undefined : s.trim()))
  .optional();

const EnvSchema = z.object({
  NODE_ENV: nonEmpty,
  VERCEL_ENV: nonEmpty,
  OPENROUTER_API_KEY: nonEmpty,
  OPENAI_API_KEY: nonEmpty,
  OPENAI_MODEL: nonEmpty,
  SUPABASE_URL: nonEmpty,
  SUPABASE_SECRET_KEY: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  VITE_POSTHOG_KEY: nonEmpty,
  VITE_POSTHOG_HOST: nonEmpty,
});

export type ServerConfig = {
  nodeEnv: string | undefined;
  isProduction: boolean;
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
  supabaseUrl: string | undefined;
  supabaseSecretKey: string | undefined;
  resendApiKey: string | undefined;
  posthogKey: string | undefined;
  posthogHost: string | undefined;
};

export function parseServerEnv(env: Record<string, string | undefined>): ServerConfig {
  const parsed = EnvSchema.parse(env);
  const isProduction = parsed.VERCEL_ENV === "production" || parsed.NODE_ENV === "production";

  if (parsed.SUPABASE_URL && !/^https?:\/\/.+/.test(parsed.SUPABASE_URL)) {
    throw new Error(`SUPABASE_URL is not a valid URL: "${parsed.SUPABASE_URL}"`);
  }

  if (isProduction) {
    // Without persistent storage the app would "work" on the per-instance
    // memory store and silently discard lessons and lead emails (it did, on
    // 2026-06-11). Production refuses to start instead.
    for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const) {
      if (!parsed[key]) {
        throw new Error(
          `Refusing to start in production: ${key} is missing or empty. Set it in Vercel and redeploy.`,
        );
      }
    }
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    isProduction,
    openaiApiKey: parsed.OPENROUTER_API_KEY ?? parsed.OPENAI_API_KEY,
    openaiModel: parsed.OPENAI_MODEL,
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseSecretKey: parsed.SUPABASE_SECRET_KEY,
    resendApiKey: parsed.RESEND_API_KEY,
    posthogKey: parsed.VITE_POSTHOG_KEY,
    posthogHost: parsed.VITE_POSTHOG_HOST,
  };
}
