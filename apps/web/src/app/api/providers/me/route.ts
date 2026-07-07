import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getMyProviderProfile, upsertMyProviderProfile } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const upsertSchema = z.object({
  headline: z.string().min(2).max(80),
  bio: z.string().max(600).optional(),
  yearsExperience: z.number().int().min(0).max(60),
  serviceRadiusKm: z.number().min(1).max(100),
  baseLat: z.number().optional(),
  baseLng: z.number().optional(),
  categoryIds: z.array(z.string().min(1)).min(1),
  services: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        priceCents: z.number().int().min(100),
        categoryId: z.string().min(1),
      }),
    )
    .min(1),
});

// GET /api/providers/me — cadastro profissional do prestador logado (null se ainda não criou).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores têm cadastro profissional", 403);
  }
  return json({ profile: await getMyProviderProfile(claims.sub) });
}

// POST /api/providers/me — cria/atualiza categorias, serviços, raio e dados profissionais.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores têm cadastro profissional", 403);
  }

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const profile = await upsertMyProviderProfile(claims.sub, parsed.data);
  return json({ profile });
}
