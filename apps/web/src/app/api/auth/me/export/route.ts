import { requireAuth } from "@/lib/auth";
import { exportAccountData } from "@/lib/account";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/auth/me/export — portabilidade de dados (RF-A7, LGPD): tudo que a
// conta gerou (perfil, endereços, pedidos, avaliações, mensagens, carteira).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const data = await exportAccountData(claims.sub);
  if (!data) return error("Usuário não encontrado", 404);

  return json({ export: data, generatedAt: new Date().toISOString() });
}
