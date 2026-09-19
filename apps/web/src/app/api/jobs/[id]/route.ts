import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/jobs/:id — detalhe da vaga, incluindo myApplication se o usuário já se candidatou.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const job = await getJob(id, claims.sub);
  if (!job) return error("Vaga não encontrada", 404);
  return json({ job });
}
