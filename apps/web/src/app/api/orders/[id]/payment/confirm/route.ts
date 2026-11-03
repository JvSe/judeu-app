import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { confirmPayment } from "@/lib/payments";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// POST /api/orders/:id/payment/confirm — reconcilia com o Stripe após PaymentSheet / Pix.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await confirmPayment(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json(result);
}
