import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createOrUpdatePayment, getPayment } from "@/lib/payments";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  method: z.enum(["PIX", "CARD", "CASH"]),
});

// GET /api/orders/:id/payment — status atual do pagamento (reconcilia com o Stripe se pendente).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await getPayment(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json(result);
}

// POST /api/orders/:id/payment — cliente cria/atualiza o pagamento do pedido.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 400);

  const result = await createOrUpdatePayment(claims.sub, id, parsed.data.method);
  if ("error" in result) return error(result.error, result.status);
  return json(result, { status: 201 });
}
