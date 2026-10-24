import { z } from "zod";

import { issueRefreshToken, requireAuth, signAccessToken } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { registerHelper } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20),
  bio: z.string().trim().max(280).optional(),
  acceptedTerms: z.literal(true),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// POST /api/providers/me/helper — cliente passa a atender ajudas abertas.
// Devolve tokens novos porque o papel sobe para BOTH.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await registerHelper(claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);

  const accessToken = await signAccessToken({ sub: result.user.id, role: result.user.role });
  const refreshToken = await issueRefreshToken(result.user.id);
  return json({ ...result, accessToken, refreshToken }, { status: 201 });
}
