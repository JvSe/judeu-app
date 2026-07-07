import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getWalletSummary } from "@/lib/wallet";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/wallet — saldo, ganhos dos últimos 7 dias e extrato do usuário atual.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const wallet = await getWalletSummary(claims.sub);
  return json({ wallet });
}
