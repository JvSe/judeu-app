import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { setProviderDocument } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"] as const;

const bodySchema = z.object({
  base64: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME),
});

// POST /api/providers/me/document — envia o documento de identidade (KYC) para o Storage.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores enviam documento de verificação", 403);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  try {
    const profile = await setProviderDocument(claims.sub, parsed.data.base64, parsed.data.mimeType);
    return json({ profile });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Falha no upload", 500);
  }
}
