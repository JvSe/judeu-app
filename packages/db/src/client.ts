import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database";

export type JudeuSupabase = SupabaseClient<Database>;

export function createServiceClient(url: string, serviceRoleKey: string): JudeuSupabase {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function assertNoError<T>(
  result: { data: T; error: { message: string } | null },
  fallback = "Erro no banco",
): T {
  if (result.error) throw new Error(`${fallback}: ${result.error.message}`);
  return result.data;
}
