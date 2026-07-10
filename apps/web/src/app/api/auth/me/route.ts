import { z } from "zod";

import { deleteAccount } from "@/lib/account";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { updateProfile } from "@/lib/profile";
import { publicUser } from "@/lib/user";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) return error("Usuário não encontrado", 404);

  return json({ user: publicUser(user) });
}

const updateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).optional(),
});

// PATCH /api/auth/me — edição de perfil (RF-A6): nome e telefone.
export async function PATCH(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const user = await updateProfile(claims.sub, parsed.data);
  return json({ user });
}

// DELETE /api/auth/me — exclusão da conta (RF-A7): anonimiza os dados pessoais e
// derruba todas as sessões; pedidos/avaliações/mensagens já trocados com outras
// partes são preservados (histórico legítimo delas).
export async function DELETE(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  await deleteAccount(claims.sub);
  return json({ ok: true });
}
