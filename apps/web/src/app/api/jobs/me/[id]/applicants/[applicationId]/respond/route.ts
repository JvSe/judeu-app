import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { respondToApplication } from "@/lib/job-applications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({ action: z.enum(["accept", "reject"]) });

// POST /api/jobs/me/:id/applicants/:applicationId/respond — empresa aceita ou recusa o candidato.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; applicationId: string }> },
) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id, applicationId } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Ação inválida", 400);

  const result = await respondToApplication(claims.sub, id, applicationId, parsed.data.action);
  if ("error" in result) return error(result.error, result.status);
  return json({ application: result });
}
