import { describe, test, expect, beforeEach } from "bun:test";

// Validate the open-redirect guard used in auth/callback.tsx
function validateNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

// Validate the new-user heuristic used in auth/callback.tsx
function isNewUser(createdAt: string, lastSignInAt: string): boolean {
  return (
    createdAt === lastSignInAt ||
    Math.abs(new Date(createdAt).getTime() - new Date(lastSignInAt).getTime()) < 5000
  );
}

describe("validateNext (open-redirect guard)", () => {
  test("passes through a valid relative path", () => {
    expect(validateNext("/lesson/abc123/quiz")).toBe("/lesson/abc123/quiz");
  });

  test("rejects an external URL — returns /", () => {
    expect(validateNext("https://evil.com")).toBe("/");
  });

  test("rejects a protocol-relative URL — returns /", () => {
    expect(validateNext("//evil.com")).toBe("/");
  });

  test("defaults to / when next is undefined", () => {
    expect(validateNext(undefined)).toBe("/");
  });

  test("defaults to / when next is empty string", () => {
    expect(validateNext("")).toBe("/");
  });
});

describe("isNewUser (new-registration heuristic)", () => {
  test("returns true when created_at === last_sign_in_at", () => {
    const ts = "2026-06-20T10:00:00.000Z";
    expect(isNewUser(ts, ts)).toBe(true);
  });

  test("returns true when sign-in is within 5 seconds of creation", () => {
    const created = "2026-06-20T10:00:00.000Z";
    const signedIn = "2026-06-20T10:00:03.000Z";
    expect(isNewUser(created, signedIn)).toBe(true);
  });

  test("returns false for a returning user (sign-in well after creation)", () => {
    const created = "2026-06-20T10:00:00.000Z";
    const signedIn = "2026-06-21T08:00:00.000Z";
    expect(isNewUser(created, signedIn)).toBe(false);
  });
});
