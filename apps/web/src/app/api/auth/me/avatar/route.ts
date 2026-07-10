import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { updateAvatar } from "@/lib/profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

const bodySchema = z.object({
  base64: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME),
});

// POST /api/auth/me/avatar — foto de perfil (RF-A6), sobe pro bucket público de avatares.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  try {
    const user = await updateAvatar(claims.sub, parsed.data.base64, parsed.data.mimeType);
    return json({ user });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Falha no upload", 500);
  }
}
