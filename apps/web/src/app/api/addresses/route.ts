import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createAddress, listAddresses } from "@/lib/addresses";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/addresses — livro de endereços do usuário atual (RF-A6), padrão primeiro.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const addresses = await listAddresses(claims.sub);
  return json({ addresses });
}

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  cep: z.string().max(9).optional(),
  street: z.string().min(2).max(160),
  number: z.string().max(20).optional(),
  complement: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(2),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

// POST /api/addresses — cadastra um novo endereço (geocodificado via Nominatim, best-effort).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = addressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const address = await createAddress(claims.sub, parsed.data);
  return json({ address }, { status: 201 });
}
