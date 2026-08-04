import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createProposal, listProposals } from "@/lib/proposals";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  priceCents: z.number().int().min(100),
  note: z.string().max(300).optional(),
});

// GET /api/orders/:id/proposals — histórico de propostas (cliente e prestador do pedido).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await listProposals(id, claims.sub);
  if ("error" in result) return error(result.error, result.status);
  return json({ proposals: result });
}

// POST /api/orders/:id/proposals — propõe um novo preço (RF-D5), antes do aceite.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Proposta inválida", 400);

  const result = await createProposal(id, claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ proposal: result }, { status: 201 });
}
