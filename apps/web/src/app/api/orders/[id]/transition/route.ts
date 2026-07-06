import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { transitionOrder } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "start_route", "start_work", "complete", "cancel"]),
  note: z.string().max(300).optional(),
});

// POST /api/orders/:id/transition — avança a máquina de estados do pedido.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Ação inválida", 400);

  const result = await transitionOrder(id, claims.sub, parsed.data.action, parsed.data.note);
  if ("error" in result) return error(result.error, result.status);
  return json({ order: result });
}
