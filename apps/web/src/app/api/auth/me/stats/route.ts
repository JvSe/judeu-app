import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getClientStats } from "@/lib/profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/auth/me/stats — pedidos concluídos + nota como cliente, pro Perfil (RF-A6).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const stats = await getClientStats(claims.sub);
  return json({ stats });
}
