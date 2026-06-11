import { createMemoryMvpStore, type MvpStore } from "./mvpFlow";
import { createSupabaseStore } from "./supabaseStore.server";
import { getServerConfig } from "./config.server";

const globalStore = globalThis as typeof globalThis & {
  __watchlaterMvpStore?: MvpStore;
};

export function getMvpStore(): MvpStore {
  if (!globalStore.__watchlaterMvpStore) {
    const config = getServerConfig();
    if (config.supabaseUrl && config.supabaseSecretKey) {
      globalStore.__watchlaterMvpStore = createSupabaseStore();
    } else {
      // The in-memory store is per-function-instance: jobs, lessons, and lead
      // emails written to it silently evaporate. In production that is an
      // outage, not a fallback — fail loudly instead. (On 2026-06-11 prod ran
      // for several minutes on this fallback after SUPABASE_SECRET_KEY went
      // missing from Vercel, looking healthy while persisting nothing.)
      if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
        throw new Error(
          "Refusing to start without persistent storage in production: " +
            "SUPABASE_URL / SUPABASE_SECRET_KEY missing. Set them in Vercel and redeploy.",
        );
      }
      console.warn(
        "[store] SUPABASE_URL / SUPABASE_SECRET_KEY not set — using the in-memory store. " +
          "Data will NOT survive a server restart (dev-only fallback).",
      );
      globalStore.__watchlaterMvpStore = createMemoryMvpStore();
    }
  }
  return globalStore.__watchlaterMvpStore;
}
