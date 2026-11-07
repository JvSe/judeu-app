import { requireAuth } from "@/lib/auth";
import { getOrderShare } from "@/lib/family";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/orders/:id/share — link de acompanhamento da família (só o cliente).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  return json({ share: await getOrderShare((await ctx.params).id, claims.sub) });
}
