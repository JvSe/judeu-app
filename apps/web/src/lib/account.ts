import { randomUUID } from "node:crypto";

import { hashPassword, revokeAllRefreshTokens } from "./auth";
import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Exclusão e exportação de conta (RF-A7, LGPD/RNF-4).
// ---------------------------------------------------------------------------

// Anonimiza em vez de apagar a linha: pedidos/avaliações/mensagens já trocados
// com outras partes continuam existindo (histórico/auditoria legítimos dessas
// outras partes) — só os dados que identificam esta pessoa são removidos.
export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { providerProfile: true },
  });
  if (!user) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${randomUUID()}@ajuda.app`,
        fullName: "Usuário excluído",
        phone: null,
        avatarUrl: null,
        passwordHash: await hashPassword(randomUUID()),
        pushToken: null,
        deletedAt: new Date(),
      },
    }),
    ...(user.providerProfile
      ? [
          prisma.providerProfile.update({
            where: { userId },
            data: { status: "BLOCKED" as const, isAvailable: false, headline: null, bio: null },
          }),
        ]
      : []),
  ]);

  await revokeAllRefreshTokens(userId);
}

// Dump simples de tudo que a conta gerou — direito de portabilidade (LGPD).
export async function exportAccountData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      createdAt: true,
      termsAcceptedAt: true,
      notifyOrders: true,
      notifyMessages: true,
      addresses: true,
      ordersAsClient: { include: { events: true } },
      reviewsAuthored: true,
      reviewsReceived: true,
      messages: true,
      wallet: { include: { transactions: true } },
      notifications: true,
      providerProfile: {
        include: {
          services: true,
          categories: true,
          ordersAsProvider: { include: { events: true } },
        },
      },
    },
  });
}
