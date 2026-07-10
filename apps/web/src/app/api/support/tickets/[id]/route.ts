import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { getSupportTicket } from "@/lib/support";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/support/tickets/[id] — detalhe de um chamado (só o autor vê).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const { id } = await ctx.params;
  const result = await getSupportTicket(claims.sub, id);
  if ("error" in result) return error(result.error, result.status);
  return json({ ticket: result });
}
