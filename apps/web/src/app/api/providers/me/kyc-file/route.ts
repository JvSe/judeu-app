import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { setProviderKycFile } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  kind: z.enum(["DOCUMENT", "SELFIE", "BACKGROUND_CHECK"]),
  base64: z.string().min(1).max(15_000_000),
  mimeType: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]),
});

// POST /api/providers/me/kyc-file — documento, selfie ou antecedentes (helper e profissional).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Arquivo inválido", 422);
  try {
    const result = await setProviderKycFile(claims.sub, parsed.data.kind, parsed.data.base64, parsed.data.mimeType);
    if ("error" in result) return error(result.error, result.status);
    return json({ profile: result });
  } catch (e) {
    console.error("[kyc-file] upload falhou:", e);
    return error("Não foi possível enviar o arquivo agora.", 500);
  }
}
