import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { REPORT_REASONS, createReport } from "@/lib/moderation";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const schema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
});

// POST /api/orders/:id/report — denuncia a outra parte do pedido.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Escolha um motivo", 422);
  const result = await createReport((await ctx.params).id, claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json(result, { status: 201 });
}
