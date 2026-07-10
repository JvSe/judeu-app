import { prisma } from "./db";
import { uploadAvatar } from "./storage";
import { publicUser, type PublicUser } from "./user";

// ---------------------------------------------------------------------------
// Edição de perfil (RF-A6): dados básicos, foto (Storage) e estatísticas como
// cliente (pedidos concluídos + nota recebida dos prestadores).
// ---------------------------------------------------------------------------

export type UpdateProfileInput = { fullName?: string; phone?: string };

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
  });
  return publicUser(user);
}

export async function updateAvatar(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<PublicUser> {
  const avatarUrl = await uploadAvatar(userId, base64, mimeType);
  const user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  return publicUser(user);
}

export type ClientStatsDTO = {
  completedOrders: number;
  ratingAvg: number | null;
  ratingCount: number;
};

// Reputação do usuário como cliente (o prestador avalia o cliente ao final do
// pedido, RF-G1) — sem coluna agregada própria (diferente de ProviderProfile),
// calculada na hora porque só alimenta esta tela.
export async function getClientStats(userId: string): Promise<ClientStatsDTO> {
  const [completedOrders, ratingAgg] = await Promise.all([
    prisma.order.count({ where: { clientId: userId, status: "COMPLETED" } }),
    prisma.review.aggregate({
      where: { targetId: userId, order: { clientId: userId } },
      _avg: { rating: true },
      _count: true,
    }),
  ]);
  return {
    completedOrders,
    ratingAvg: ratingAgg._avg.rating,
    ratingCount: ratingAgg._count,
  };
}
