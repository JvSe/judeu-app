import { z } from "zod";

import { issueRefreshToken, signAccessToken, verifyPassword } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser } from "@/lib/user";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Dados inválidos", 422);

  const { password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const { data: user } = await supabase.from("user").select("*").eq("email", email).maybeSingle();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return error("E-mail ou senha incorretos", 401);
  }
  if (user.blockedAt) {
    return error("Sua conta está suspensa. Fale com o suporte pelo e-mail de atendimento.", 403);
  }

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return json({ user: publicUser(user), accessToken, refreshToken });
}
