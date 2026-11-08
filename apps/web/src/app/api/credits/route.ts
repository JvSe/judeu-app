import { requireAuth } from "@/lib/auth";
import { creditBalance } from "@/lib/discounts";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/credits — saldo de crédito do cliente (cupom de indicação, cortesia etc.).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  return json({ balanceCents: await creditBalance(claims.sub) });
}
