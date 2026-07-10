import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { updateOrderLocation } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// POST /api/orders/:id/location — prestador reporta a posição atual (RF-E3).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Posição inválida", 400);

  const result = await updateOrderLocation(id, claims.sub, parsed.data.lat, parsed.data.lng);
  if ("error" in result) return error(result.error, result.status);
  return json({ order: result });
}
