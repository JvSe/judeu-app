import { z } from "zod";

import { runAssistant } from "@/lib/assistant";
import { requireAuth } from "@/lib/auth";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const schema = z.object({
  message: z.string().trim().min(1).max(600),
  conversationId: z.string().min(1).max(64).nullish(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .default([]),
});

// POST /api/assistant — JudIA em nuvem (reserva quando a IA não roda no aparelho).
export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);
  return json(
    await runAssistant(claims.sub, {
      message: parsed.data.message,
      history: parsed.data.history,
      conversationId: parsed.data.conversationId ?? null,
    }),
  );
}
