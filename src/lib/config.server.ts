import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

import { parseServerEnv, type ServerConfig } from "./serverEnv";

// The full schema (every variable, validation, the production storage guard)
// lives in serverEnv.ts — this wrapper just feeds it process.env per-request.
//
// Note on SUPABASE_SECRET_KEY: sb_secret_... only. The legacy JWT service_role
// key is NOT supported — it can't be revoked without rotating the project's
// JWT secret (how the 2026-06 leak stayed valid), and legacy JWT keys are
// disabled on the Supabase project. Do not reintroduce them.
export function getServerConfig(): ServerConfig {
  return parseServerEnv(process.env as Record<string, string | undefined>);
}
