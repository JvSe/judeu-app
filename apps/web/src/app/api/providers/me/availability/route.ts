import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { setProviderAvailability } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const availabilitySchema = z.object({ isAvailable: z.boolean() });

// POST /api/providers/me/availability — liga/desliga a disponibilidade (RF-B4).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores têm disponibilidade", 403);
  }

  const parsed = availabilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const profile = await setProviderAvailability(claims.sub, parsed.data.isAvailable);
  return json({ profile });
}
