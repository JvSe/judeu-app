import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { listProviderReviews } from "@/lib/reviews";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/providers/:id/reviews — avaliações públicas recebidas pelo prestador.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const reviews = await listProviderReviews(id);
  return json({ reviews });
}
