import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getPayoutOverview, requestPayout } from "@/lib/payouts";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/wallet/payouts — chave Pix, saldo disponível/retido e saques anteriores.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  return json(await getPayoutOverview(claims.sub));
}

const schema = z.object({ amountCents: z.number().int().positive().max(10_000_000) });

// POST /api/wallet/payouts — solicita um saque (simulado enquanto PAYOUT_PROVIDER=simulated).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Valor inválido", 422);
  const result = await requestPayout(claims.sub, parsed.data.amountCents);
  if ("error" in result) return error(result.error, result.status);
  return json({ payout: result }, { status: 201 });
}
