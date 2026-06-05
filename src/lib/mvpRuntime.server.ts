import { createMemoryMvpStore, type MvpStore } from "./mvpFlow";
import { createSupabaseStore } from "./supabaseStore.server";
import { getServerConfig } from "./config.server";

const globalStore = globalThis as typeof globalThis & {
  __videosenseMvpStore?: MvpStore;
};

export function getMvpStore(): MvpStore {
  if (!globalStore.__videosenseMvpStore) {
    const config = getServerConfig();
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      globalStore.__videosenseMvpStore = createSupabaseStore();
    } else {
      globalStore.__videosenseMvpStore = createMemoryMvpStore();
    }
  }
  return globalStore.__videosenseMvpStore;
}
