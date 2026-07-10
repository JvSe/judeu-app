import { z } from "zod";

import { hashPassword, issueRefreshToken, signAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";
import { publicUser, roleSchema } from "@/lib/user";

export const runtime = "nodejs";

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  phone: z.string().min(8).max(20).optional(),
  role: roleSchema.optional(),
  // Consentimento explícito aos Termos de Uso/Política de Privacidade (RNF-4, LGPD) — sem
  // isso a conta não é criada, mesmo padrão de "checkbox obrigatório" de qualquer app sério.
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error("E-mail já cadastrado", 409);

  const finalRole = role ?? "CLIENT";
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      role: finalRole,
      passwordHash: await hashPassword(password),
      termsAcceptedAt: new Date(),
      // Prestador nasce com o cadastro profissional vazio (status PENDING) — ele
      // só aparece pra clientes depois da KYC aprovada (RF-B2/B3, catalog.ts filtra APPROVED).
      ...(finalRole === "PROVIDER" || finalRole === "BOTH"
        ? { providerProfile: { create: {} } }
        : {}),
    },
  });

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  return json({ user: publicUser(user), accessToken, refreshToken }, { status: 201 });
}
