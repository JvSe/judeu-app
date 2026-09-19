import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { applyToJob } from "@/lib/job-applications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({ message: z.string().max(500).optional() });

// POST /api/jobs/:id/apply — candidata o usuário logado à vaga.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await applyToJob(claims.sub, id, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ application: result }, { status: 201 });
}
