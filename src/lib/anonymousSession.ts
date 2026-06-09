const KEY = "watchlater_session_key";

export function getBrowserSessionKey(): string {
  if (typeof window === "undefined") return "server-session";
  const existing = window.localStorage.getItem(KEY);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(KEY, next);
  return next;
}
