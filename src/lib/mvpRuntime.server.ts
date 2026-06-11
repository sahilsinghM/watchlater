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
      globalStore.__watchlaterMvpStore = createMemoryMvpStore();
    }
  }
  return globalStore.__watchlaterMvpStore;
}
