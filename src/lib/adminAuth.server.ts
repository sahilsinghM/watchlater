import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie } from "@tanstack/react-start/server";

export function adminToken(secret: string) {
  return createHmac("sha256", secret).update("admin-session").digest("hex");
}

export function isAdminAuthed(): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const cookie = getCookie("admin_auth") ?? "";
  const expected = adminToken(secret);
  if (cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
