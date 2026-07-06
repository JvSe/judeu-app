import { z } from "zod";

import { hashPassword, issueRefreshToken, signAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser, roleSchema } from "@/lib/user";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  phone: z.string().min(8).max(20).optional(),
  role: roleSchema.optional(),
});

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Dados inválidos", 422);

  const { fullName, password, phone, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error("E-mail já cadastrado", 409);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      role: role ?? "CLIENT",
      passwordHash: await hashPassword(password),
    },
  });

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return json({ user: publicUser(user), accessToken, refreshToken }, { status: 201 });
}
