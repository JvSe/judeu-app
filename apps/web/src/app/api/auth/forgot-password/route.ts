import { z } from "zod";

import { issuePasswordResetCode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleOptions, json } from "@/lib/http";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({ email: z.email() });

export function OPTIONS() {
  return handleOptions();
}

// POST /api/auth/forgot-password — sempre responde 200 (evita enumeração de e-mail);
// se a conta existir, gera um código e "envia" (best-effort, sem provedor real ainda).
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: true });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const code = await issuePasswordResetCode(user.id);
    void sendEmail({
      to: user.email,
      subject: "Seu código de recuperação — Ajuda+",
      body: `Seu código é ${code}. Ele expira em 15 minutos.`,
    });
  }

  return json({ ok: true });
}
