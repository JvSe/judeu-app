import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createReview, getMyReview } from "@/lib/reviews";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// GET /api/orders/:id/review — a avaliação que o usuário atual fez deste pedido.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const review = await getMyReview(claims.sub, id);
  return json({ review });
}

// POST /api/orders/:id/review — avalia a outra parte do pedido concluído.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Avaliação inválida", 400);

  const result = await createReview(claims.sub, id, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ review: result }, { status: 201 });
}
