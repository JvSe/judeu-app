import { z } from "zod";

import { rotateRefreshToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser } from "@/lib/user";

export const runtime = "nodejs";

const schema = z.object({ refreshToken: z.string().min(1) });

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Dados inválidos", 422);

  const rotated = await rotateRefreshToken(parsed.data.refreshToken);
  if (!rotated) return error("Sessão expirada", 401);

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user) return error("Sessão inválida", 401);

  return json({
    user: publicUser(user),
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
  });
}
