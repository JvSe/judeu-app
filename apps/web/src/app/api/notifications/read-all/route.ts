import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { markAllNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// POST /api/notifications/read-all — "Marcar lidas" no centro de notificações.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { count } = await markAllNotificationsRead(claims.sub);
  return json({ ok: true, count });
}
