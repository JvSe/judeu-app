import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getNotificationPreferences, setNotificationPreferences } from "@/lib/notifications";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/notifications/preferences — preferências por tipo de evento (RF-I1).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const preferences = await getNotificationPreferences(claims.sub);
  return json({ preferences });
}

export const notificationPreferencesSchema = z
  .object({ notifyOrders: z.boolean().optional(), notifyMessages: z.boolean().optional() })
  .refine((v) => v.notifyOrders !== undefined || v.notifyMessages !== undefined, {
    message: "Informe ao menos uma preferência",
  });

// POST /api/notifications/preferences — liga/desliga notificações de pedidos e/ou mensagens.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = notificationPreferencesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const preferences = await setNotificationPreferences(claims.sub, parsed.data);
  return json({ preferences });
}
