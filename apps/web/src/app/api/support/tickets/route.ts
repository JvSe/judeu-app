import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";
import { createSupportTicket, listMySupportTickets } from "@/lib/support";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/support/tickets — chamados do usuário atual, mais recentes primeiro.
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const tickets = await listMySupportTickets(claims.sub);
  return json({ tickets });
}

export const createSupportTicketSchema = z.object({
  category: z.enum(["PAYMENT", "CANCELLATION", "SECURITY", "ACCOUNT", "DISPUTE", "OTHER"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  orderId: z.string().uuid().optional(),
});

// POST /api/support/tickets — abre um chamado (dúvida geral, RF-H1, ou contestação de
// pedido quando `orderId` é enviado, RF-H2).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = createSupportTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const result = await createSupportTicket(claims.sub, parsed.data);
  if ("error" in result) return error(result.error, result.status);
  return json({ ticket: result }, { status: 201 });
}
