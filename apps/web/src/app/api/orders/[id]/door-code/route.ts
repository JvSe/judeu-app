import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getDoorCode } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/orders/:id/door-code — código de chegada (só o cliente do pedido).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const result = await getDoorCode((await ctx.params).id, claims.sub);
  if ("error" in result) return error(result.error, result.status);
  return json(result);
}

// POST /api/orders/:id/door-code — gera um novo código (ex.: depois de bloquear por tentativas).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const result = await getDoorCode((await ctx.params).id, claims.sub, true);
  if ("error" in result) return error(result.error, result.status);
  return json(result);
}
