import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { openRequestAvailability } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  categoryId: z.string().min(1).optional(),
});

// GET /api/orders/availability?lat=&lng=&categoryId= — "N pessoas perto, ~X min"
// antes de publicar uma ajuda aberta. Só números, sem identificar ninguém.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
    categoryId: url.searchParams.get("categoryId") ?? undefined,
  });
  if (!parsed.success) return error("Coordenadas inválidas", 400);
  const { lat, lng, categoryId } = parsed.data;
  return json(await openRequestAvailability(claims.sub, { lat, lng }, categoryId ?? null));
}
