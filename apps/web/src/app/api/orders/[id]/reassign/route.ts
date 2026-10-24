import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { reassignOrder } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  providerId: z.string().min(1),
});

// POST /api/orders/:id/reassign — cliente troca a pessoa da chamada ainda CREATED.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 400);

  const result = await reassignOrder(id, claims.sub, parsed.data.providerId);
  if ("error" in result) return error(result.error, result.status);
  return json({ order: result });
}
