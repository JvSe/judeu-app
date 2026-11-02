import { createServiceClient, type JudeuSupabase } from "@judeu/db";
import { env } from "@judeu/env/server";

const globalForDb = globalThis as unknown as {
  supabase?: JudeuSupabase;
};

export const supabase =
  globalForDb.supabase ??
  createServiceClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

globalForDb.supabase = supabase;
