import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { updateProviderLocation } from "@/lib/provider-profile";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// POST /api/providers/me/location — GPS ocioso enquanto o prestador está online.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  if (claims.role !== "PROVIDER" && claims.role !== "BOTH") {
    return error("Só prestadores enviam localização", 403);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await updateProviderLocation(claims.sub, parsed.data.lat, parsed.data.lng);
  if ("error" in result) return error(result.error, result.status);
  return json({ profile: result });
}
