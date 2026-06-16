import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, setResponseStatus } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabase-admin.server";

function adminToken(secret: string) {
  return createHmac("sha256", secret).update("admin-session").digest("hex");
}

function assertAdminAuth() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    setResponseStatus(403);
    throw new Error("Forbidden");
  }
  const cookie = getCookie("admin_auth") ?? "";
  const expected = adminToken(secret);
  const valid =
    cookie.length === expected.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
  if (!valid) {
    setResponseStatus(403);
    throw new Error("Forbidden");
  }
}

export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || data.password !== secret) {
      setResponseStatus(403);
      throw new Error("Invalid password");
    }
    setCookie("admin_auth", adminToken(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return { ok: true };
  });

function toDateStr(iso: string) {
  return iso.slice(0, 10);
}

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  assertAdminAuth();
  const db = getSupabaseAdmin();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: uniqueVideoCount },
    { data: videoRows },
    { count: quizCompletionCount },
    { data: feedbackRows },
    { count: leadCount },
  ] = await Promise.all([
    db.from("videos").select("*", { count: "exact", head: true }),
    db.from("videos").select("created_at").gte("created_at", thirtyDaysAgo),
    db.from("quiz_results").select("*", { count: "exact", head: true }),
    db.from("feedback").select("useful"),
    db.from("leads").select("*", { count: "exact", head: true }),
  ]);

  // Group videos by date in JS
  const byDate: Record<string, number> = {};
  for (const row of videoRows ?? []) {
    const d = toDateStr(row.created_at);
    byDate[d] = (byDate[d] ?? 0) + 1;
  }
  const videosPerDay = Object.entries(byDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const usefulCount = feedbackRows?.filter((r) => r.useful === true).length ?? 0;
  const notUsefulCount = feedbackRows?.filter((r) => r.useful === false).length ?? 0;

  return {
    uniqueVideoCount: uniqueVideoCount ?? 0,
    videosPerDay,
    quizCompletionCount: quizCompletionCount ?? 0,
    leadCount: leadCount ?? 0,
    feedbackSentiment: { useful: usefulCount, notUseful: notUsefulCount },
  };
});

export const getAdminLeads = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertAdminAuth();
    const db = getSupabaseAdmin();
    const { data: leads, error } = await db
      .from("leads")
      .select("id, email, source, created_at, lesson_video_id")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw error;
    return leads ?? [];
  });
