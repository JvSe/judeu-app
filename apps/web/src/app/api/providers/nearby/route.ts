import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { listNearbyProviders } from "@/lib/catalog";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  categoryId: z.string().min(1).optional(),
  excludeProviderId: z.string().min(1).optional(),
});

// GET /api/providers/nearby?lat=&lng=&categoryId= — pessoas disponíveis no raio.
export async function GET(req: Request) {
  if (!(await requireAuth(req))) return error("Não autenticado", 401);
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    excludeProviderId: url.searchParams.get("excludeProviderId") ?? undefined,
  });
  if (!parsed.success) return error("Coordenadas inválidas", 400);
  return json({ providers: await listNearbyProviders(parsed.data) });
}
