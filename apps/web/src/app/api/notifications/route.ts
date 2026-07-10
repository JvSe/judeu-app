import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { listNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/notifications — centro de notificações in-app do usuário atual (RF-I1):
// últimas 50, mais recentes primeiro, + contagem de não lidas para o badge.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { items, unreadCount } = await listNotifications(claims.sub);
  return json({ notifications: items, unreadCount });
}
