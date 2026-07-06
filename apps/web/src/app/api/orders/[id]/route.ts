import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const order = await getOrder(id, claims.sub);
  if (!order) return error("Pedido não encontrado", 404);
  return json({ order });
}
