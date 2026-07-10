import { requireAuth } from "@/lib/auth";
import { setDefaultAddress } from "@/lib/addresses";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// POST /api/addresses/[id]/default — marca um endereço salvo como padrão.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const { id } = await ctx.params;
  const result = await setDefaultAddress(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json({ address: result });
}
