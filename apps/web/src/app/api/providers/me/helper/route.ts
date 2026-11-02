import { z } from "zod";

import { issueRefreshToken, requireAuth, signAccessToken } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { registerHelper, updateHelperProfile } from "@/lib/provider-profile";

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

const patchSchema = z.object({
  bio: z.string().trim().max(280).optional(),
  serviceRadiusKm: z.number().min(1).max(100).optional(),
});

// PATCH /api/providers/me/helper — edita bio/raio de quem atende, sem mexer em
// isHelper/status (o upsert profissional em POST /api/providers/me rebaixaria o helper).
export async function PATCH(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só quem atende ajudas edita esse cadastro", 403);
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const profile = await updateHelperProfile(claims.sub, parsed.data);
  if ("error" in profile) return error(profile.error, profile.status);
  return json({ profile });
}
