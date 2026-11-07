import { z } from "zod";

import { issuePasswordResetCode } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ email: z.email() });

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: true });

  const email = parsed.data.email.toLowerCase();
  const { data: user } = await supabase
    .from("user")
    .select("id, deletedAt")
    .eq("email", email)
    .maybeSingle();
  if (user && !user.deletedAt) {
    // Falha de envio não muda a resposta: não revela se o e-mail existe.
    await issuePasswordResetCode(user.id, email).catch((err) =>
      console.error("[forgot-password] falha ao emitir código:", err),
    );
  }

  return json({ ok: true });
}
