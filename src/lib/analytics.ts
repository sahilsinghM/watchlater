import posthog from "posthog-js";

export type PageName =
  | "landing"
  | "processing"
  | "lesson_hero"
  | "lesson_player"
  | "lesson_quiz"
  | "lesson_done"
  | "admin";

export type SectionName =
  | "landing_hero"
  | "landing_what"
  | "landing_how"
  | "hero_summary"
  | "hero_attention_map"
  | "hero_waitlist_card"
  | "hero_recommendation"
  | "hero_quiz_cta"
  | "player_card";

export type ClickEvent =
  | "landing_generate_cta"
  | "hero_start_lesson"
  | "hero_watch_best_part"
  | "hero_share"
  | "hero_join_waitlist"
  | "hero_open_tutor"
  | "hero_quiz_cta"
  | "hero_attention_segment"
  | "player_reaction"
  | "player_tone_toggle"
  | "player_next_card"
  | "player_prev_card"
  | "quiz_answer_selected"
  | "quiz_next_question"
  | "quiz_finish"
  | "done_feedback_useful"
  | "done_feedback_not_useful"
  | "done_try_again"
  | "done_share"
  | "done_process_another";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage",
  });
  initialized = true;
}

export function identifySession(sessionKey: string) {
  if (typeof window === "undefined" || !initialized) return;
  posthog.identify(sessionKey);
}

export function trackPageView(page: PageName, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || !initialized) return;
  posthog.capture("$pageview", { page, ...props });
}

export function trackClick(event: ClickEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || !initialized) return;
  posthog.capture(event, props);
}

export function trackSectionVisible(section: SectionName, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || !initialized) return;
  posthog.capture("section_visible", { section, ...props });
}

export function mapPathToPage(pathname: string): PageName {
  if (pathname === "/") return "landing";
  if (pathname === "/admin") return "admin";
  if (pathname.startsWith("/processing/")) return "processing";
  if (pathname.endsWith("/player")) return "lesson_player";
  if (pathname.endsWith("/quiz")) return "lesson_quiz";
  if (pathname.endsWith("/done")) return "lesson_done";
  if (pathname.startsWith("/lesson/")) return "lesson_hero";
  return "landing";
}
