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
      // In production parseServerEnv has already thrown before we get here
      // (the storage guard lives in serverEnv.ts) — this branch is dev-only.
      console.warn(
        "[store] SUPABASE_URL / SUPABASE_SECRET_KEY not set — using the in-memory store. " +
          "Data will NOT survive a server restart (dev-only fallback).",
      );
      globalStore.__watchlaterMvpStore = createMemoryMvpStore();
    }
  }
  return globalStore.__watchlaterMvpStore;
}
