import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabase-admin.server";

export const linkAnonSessionToUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), sessionKey: z.string() }))
  .handler(async ({ data }) => {
    const db = getSupabaseAdmin();
    await db.from("user_sessions").upsert(
      { user_id: data.userId, session_key: data.sessionKey },
      { onConflict: "user_id" },
    );
    return { ok: true };
  });
