import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { listMessages, sendMessage } from "@/lib/chat";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

// GET /api/orders/:id/messages — histórico do pedido (marca lidas as da outra parte).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const result = await listMessages(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json({ messages: result });
}

// POST /api/orders/:id/messages — envia mensagem para a outra parte do pedido.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Mensagem inválida", 400);

  const result = await sendMessage(claims.sub, id, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ message: result }, { status: 201 });
}
