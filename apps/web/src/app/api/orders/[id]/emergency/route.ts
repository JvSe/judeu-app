import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { triggerEmergency } from "@/lib/emergency";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const schema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// POST /api/orders/:id/emergency — registra a emergência (o app já ligou para o 190).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse((await req.json().catch(() => ({}))) ?? {});
  const pos = parsed.success && parsed.data.lat != null && parsed.data.lng != null
    ? { lat: parsed.data.lat, lng: parsed.data.lng }
    : null;
  const result = await triggerEmergency((await ctx.params).id, claims.sub, pos);
  if ("error" in result) return error(result.error, result.status);
  return json(result, { status: 201 });
}
