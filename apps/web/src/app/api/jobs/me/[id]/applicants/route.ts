import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { listApplicationsForJob } from "@/lib/job-applications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/jobs/me/:id/applicants — candidatos de uma vaga da empresa logada.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await listApplicationsForJob(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json({ applicants: result });
}
