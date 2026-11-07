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
  minRating: z.coerce.number().min(1).max(5).optional(),
  minCompleted: z.coerce.number().int().min(1).optional(),
  gender: z.enum(["F", "M"]).optional(),
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
    minRating: url.searchParams.get("minRating") ?? undefined,
    minCompleted: url.searchParams.get("minCompleted") ?? undefined,
    gender: url.searchParams.get("gender") ?? undefined,
  });
  if (!parsed.success) return error("Coordenadas inválidas", 400);
  const { lat, lng, categoryId, minRating, minCompleted, gender } = parsed.data;
  return json(
    await openRequestAvailability(claims.sub, { lat, lng }, categoryId ?? null, {
      minRating: minRating ?? null,
      minCompleted: minCompleted ?? null,
      gender: gender ?? null,
    }),
  );
}
