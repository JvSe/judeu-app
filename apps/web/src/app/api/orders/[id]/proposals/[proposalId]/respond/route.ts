import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { respondToProposal } from "@/lib/proposals";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({ action: z.enum(["accept", "reject"]) });

// POST /api/orders/:id/proposals/:proposalId/respond — a outra parte aceita ou recusa (RF-D5).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; proposalId: string }> },
) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id, proposalId } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Ação inválida", 400);

  const result = await respondToProposal(id, proposalId, claims.sub, parsed.data.action);
  if ("error" in result) return error(result.error, result.status);
  return json({ proposal: result });
}
