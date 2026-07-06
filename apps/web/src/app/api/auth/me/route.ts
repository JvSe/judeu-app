import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
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
