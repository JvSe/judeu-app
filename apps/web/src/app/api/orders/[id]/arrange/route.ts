import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { arrangeOrder } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  addressId: z.string().min(1).optional(),
  pickupAddressId: z.string().min(1).nullable().optional(),
  detailsReady: z.boolean().optional(),
});

// PATCH /api/orders/:id/arrange — cliente define locais ou libera o trajeto (chat).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 400);

  const result = await arrangeOrder(id, claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ order: result });
}
