import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createOrder, listClientOrders, listProviderOrders } from "@/lib/orders";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const createSchema = z
  .object({
    providerId: z.string().min(1).optional(),
    serviceId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    description: z.string().max(1000).optional(),
    scheduledAt: z.string().datetime().optional(),
    addressId: z.string().min(1).optional(),
    pickupAddressId: z.string().min(1).optional(),
    priceCents: z.number().int().min(0).max(1_000_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.providerId && !data.addressId) {
      ctx.addIssue({ code: "custom", message: "addressId obrigatório", path: ["addressId"] });
    }
  });

// GET /api/orders?as=client|provider — lista os pedidos do usuário no papel escolhido.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const as = new URL(req.url).searchParams.get("as") ?? "client";
  const orders =
    as === "provider" ? await listProviderOrders(claims.sub) : await listClientOrders(claims.sub);
  return json({ orders });
}

// POST /api/orders — cria contrato dirigido (com providerId) ou solicitação aberta.
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 400);

  const result = await createOrder(claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ order: result }, { status: 201 });
}
