import { createMemoryMvpStore, type MvpStore } from "./mvpFlow";

const globalStore = globalThis as typeof globalThis & {
  __videosenseMvpStore?: MvpStore;
};

export function getMvpStore(): MvpStore {
  globalStore.__videosenseMvpStore ??= createMemoryMvpStore();
  return globalStore.__videosenseMvpStore;
}
