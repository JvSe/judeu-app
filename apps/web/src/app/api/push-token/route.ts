import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({ pushToken: z.string().min(1).max(200) });

// POST /api/push-token — registra (ou substitui) o Expo push token do dispositivo atual.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  await prisma.user.update({
    where: { id: claims.sub },
    data: { pushToken: parsed.data.pushToken },
  });
  return json({ ok: true });
}
