import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set");
  _client = createClient(url, key, {
    auth: { flowType: "pkce", storage: window.localStorage },
  });
  return _client;
}
