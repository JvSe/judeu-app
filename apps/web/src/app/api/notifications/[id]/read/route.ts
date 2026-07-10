import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { markNotificationRead } from "@/lib/notifications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// POST /api/notifications/[id]/read — marca uma notificação como lida (tap no item/ao abrir o destino).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const result = await markNotificationRead(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json({ notification: result });
}
