import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { deleteAddress, updateAddress } from "@/lib/addresses";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const addressPatchSchema = z.object({
  label: z.string().max(40).optional(),
  cep: z.string().max(9).optional(),
  street: z.string().min(2).max(160).optional(),
  number: z.string().max(20).optional(),
  complement: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  city: z.string().min(2).max(80).optional(),
  state: z.string().min(2).max(2).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// PATCH /api/addresses/[id] — edita um endereço salvo (RF-A6); 404 se não for do usuário.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = addressPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const { id } = await ctx.params;
  const result = await updateAddress(claims.sub, id, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ address: result });
}

// DELETE /api/addresses/[id] — remove um endereço salvo; promove outro a padrão se preciso.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const { id } = await ctx.params;
  const result = await deleteAddress(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json(result);
}
