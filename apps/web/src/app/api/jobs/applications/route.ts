import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { listMyApplications } from "@/lib/job-applications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/jobs/applications — candidaturas do usuário logado, com status.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  return json({ applications: await listMyApplications(claims.sub) });
}
