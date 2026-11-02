import { z } from "zod";

import {
  consumePasswordResetCode,
  hashPassword,
  issueRefreshToken,
  revokeAllRefreshTokens,
  signAccessToken,
} from "@/lib/auth";
import { supabase } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser } from "@/lib/user";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(200),
});

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Dados inválidos", 422);

  const { code, newPassword } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const { data: user } = await supabase.from("user").select("*").eq("email", email).maybeSingle();
  if (!user || !(await consumePasswordResetCode(user.id, code))) {
    return error("Código inválido ou expirado", 400);
  }

  await supabase
    .from("user")
    .update({
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", user.id);
  await revokeAllRefreshTokens(user.id);

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return json({ user: publicUser(user), accessToken, refreshToken });
}
