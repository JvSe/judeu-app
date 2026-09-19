import { z } from "zod";

import { issuePasswordResetCode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ email: z.email() });

export function OPTIONS() {
  return handleOptions();
}

// POST /api/auth/forgot-password — sempre responde 200 (evita enumeração de e-mail);
// se a conta existir, emite o código fixo do MVP (123456). Sem disparo de e-mail.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: true });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await issuePasswordResetCode(user.id);
  }

  return json({ ok: true });
}
