import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

const bodySchema = z.object({ pushToken: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const claims = await requireAuth(req);
  if (!claims) return error("Não autenticado", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  await supabase
    .from("user")
    .update({ pushToken: parsed.data.pushToken, updatedAt: new Date().toISOString() })
    .eq("id", claims.sub);
  return json({ ok: true });
}
