import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getServerConfig } from "./config.server";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const config = getServerConfig();
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set (sb_secret_... key — legacy JWT service_role keys are disabled on this project)",
    );
  }
  adminClient = createClient<Database>(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false },
  });
  return adminClient;
}
