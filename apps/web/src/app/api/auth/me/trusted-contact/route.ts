import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getTrustedContact, setTrustedContact } from "@/lib/family";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

// GET /api/auth/me/trusted-contact — contato de confiança (modo família).
export async function GET(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  return json({ contact: await getTrustedContact(claims.sub) });
}

const schema = z.object({
  contact: z.object({ name: z.string().trim().min(2).max(80), email: z.email() }).nullable(),
});

// PUT /api/auth/me/trusted-contact — salva ou remove ({ contact: null }).
export async function PUT(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Informe nome e um e-mail válido", 422);
  return json({ contact: await setTrustedContact(claims.sub, parsed.data.contact) });
}
