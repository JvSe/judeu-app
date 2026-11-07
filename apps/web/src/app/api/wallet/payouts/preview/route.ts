import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { previewPayout } from "@/lib/payouts";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/wallet/payouts/preview?amountCents= — "como fica depois do saque".
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const amountCents = Number(new URL(req.url).searchParams.get("amountCents"));
  if (!Number.isFinite(amountCents) || amountCents < 0) return error("Valor inválido", 422);
  return json(await previewPayout(claims.sub, amountCents));
}
