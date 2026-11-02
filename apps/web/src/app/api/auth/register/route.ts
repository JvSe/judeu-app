import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hashPassword, issueRefreshToken, signAccessToken } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser, roleSchema } from "@/lib/user";

export const runtime = "nodejs";

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  phone: z.string().min(8).max(20).optional(),
  role: roleSchema.optional(),
  acceptedTerms: z.literal(true),
});

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return error("Dados inválidos", 422);

  const { fullName, password, phone, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const { data: existing } = await supabase.from("user").select("id").eq("email", email).maybeSingle();
  if (existing) return error("E-mail já cadastrado", 409);

  const finalRole = role ?? "CLIENT";
  const now = new Date().toISOString();
  const userId = randomUUID();

  const { data: user, error: insertError } = await supabase
    .from("user")
    .insert({
      id: userId,
      fullName,
      email,
      phone: phone ?? null,
      role: finalRole,
      passwordHash: await hashPassword(password),
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .select("*")
    .single();
  if (insertError || !user) return error(insertError?.message ?? "Falha ao criar conta", 500);

  if (finalRole === "PROVIDER" || finalRole === "BOTH") {
    const { error: profileError } = await supabase.from("providerprofile").insert({
      id: randomUUID(),
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    if (profileError) return error(profileError.message, 500);
  }

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return json({ user: publicUser(user), accessToken, refreshToken }, { status: 201 });
}
