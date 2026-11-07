import { env } from "@judeu/env/server";

import { error, json } from "@/lib/http";
import { CRON_JOBS } from "@/lib/cron";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runJobs } from "@/lib/cron/runner";

export const runtime = "nodejs";

// Chamado a cada minuto pelo pg_cron (packages/db/supabase/rpcs/004_cron_tick.sql).
// Servidor → servidor: sem CORS.
export async function POST(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"), env.CRON_SECRET)) {
    return error("Não autorizado", 401);
  }
  const results = await runJobs(CRON_JOBS);
  const failed = results.filter((r) => !r.ok).length;
  return json({ ok: failed === 0, results }, { status: failed ? 500 : 200 });
}
