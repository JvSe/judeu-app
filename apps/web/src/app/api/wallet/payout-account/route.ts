import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { savePayoutAccount } from "@/lib/payouts";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const schema = z.object({
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]),
  pixKey: z.string().trim().min(3).max(120),
  holderName: z.string().trim().min(3).max(120),
});

// PUT /api/wallet/payout-account — cadastra/troca a chave Pix de saque.
export async function PUT(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);
  const result = await savePayoutAccount(claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ account: result });
}
