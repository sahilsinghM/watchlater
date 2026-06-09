import { getBrowserSessionKey } from "./anonymousSession";
import { submitLead } from "./feedback.functions";
import type { LeadSource } from "./mvpFlow";

const FLAG = "watchlater_lead_captured";

// Once a visitor is on the early-access list we don't ask again on any screen.
// The localStorage flag gives an instant client-side decision on load; the
// unique-email upsert on the server is the cross-device source of truth.
export function hasCapturedLead(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FLAG) === "1";
}

export function markLeadCaptured(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FLAG, "1");
}

// Light client-side gate so we don't round-trip obviously bad input; the server
// fn re-validates with zod's email() as the real boundary.
export function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function captureLead(input: {
  email: string;
  source: LeadSource;
  lessonVideoId?: string;
}): Promise<void> {
  await submitLead({
    data: {
      sessionKey: getBrowserSessionKey(),
      email: input.email.trim(),
      source: input.source,
      lessonVideoId: input.lessonVideoId,
    },
  });
  markLeadCaptured();
}
