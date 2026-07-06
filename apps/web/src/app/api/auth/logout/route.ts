import { z } from "zod";

import { revokeRefreshToken } from "@/lib/auth";
import { handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ refreshToken: z.string().min(1) });

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) await revokeRefreshToken(parsed.data.refreshToken);
  // Sempre 200: logout é idempotente.
  return json({ ok: true });
}
