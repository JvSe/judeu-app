import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Reputação: avaliação bidirecional após a conclusão do pedido (RF-G1/G2).
// Cliente avalia o prestador e vice-versa; um review por autor por pedido.
// ---------------------------------------------------------------------------

export type ReviewDTO = {
  id: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type CreateReviewInput = {
  rating: number; // 1..5
  comment?: string;
};

// Recalcula ratingAvg/ratingCount do prestador a partir dos reviews recebidos
// em pedidos onde ele atuou como prestador.
async function recomputeProviderRating(providerProfileId: string, providerUserId: string) {
  const agg = await prisma.review.aggregate({
    where: { targetId: providerUserId, order: { providerId: providerProfileId } },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.providerProfile.update({
    where: { id: providerProfileId },
    data: {
      ratingAvg: agg._avg.rating ?? 0,
      ratingCount: agg._count,
    },
  });
}

export async function createReview(
  authorId: string,
  orderId: string,
  input: CreateReviewInput,
): Promise<ReviewDTO | { error: string; status: number }> {
  if (input.rating < 1 || input.rating > 5) {
    return { error: "Nota deve estar entre 1 e 5", status: 400 };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { provider: { select: { id: true, userId: true } } },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const isClient = order.clientId === authorId;
  const isProvider = order.provider?.userId === authorId;
  if (!isClient && !isProvider) {
    return { error: "Você não participou deste pedido", status: 403 };
  }
  if (order.status !== "COMPLETED") {
    return { error: "Só é possível avaliar pedidos concluídos", status: 409 };
  }

  // Alvo é a outra parte do pedido.
  const targetId = isClient ? order.provider?.userId : order.clientId;
  if (!targetId) return { error: "Não há prestador para avaliar", status: 400 };

  try {
    const review = await prisma.review.create({
      data: {
        order: { connect: { id: orderId } },
        author: { connect: { id: authorId } },
        target: { connect: { id: targetId } },
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    // Se o alvo é o prestador do pedido, atualiza sua reputação pública.
    if (isClient && order.provider) {
      await recomputeProviderRating(order.provider.id, order.provider.userId);
    }

    return {
      id: review.id,
      orderId: review.orderId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      author: { id: review.author.id, name: review.author.fullName },
    };
  } catch (e) {
    // Violação da @@unique([orderId, authorId]) → já avaliou este pedido.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { error: "Você já avaliou este pedido", status: 409 };
    }
    throw e;
  }
}

// Review que o usuário atual escreveu para um pedido (null se ainda não avaliou).
export async function getMyReview(authorId: string, orderId: string): Promise<ReviewDTO | null> {
  const review = await prisma.review.findUnique({
    where: { orderId_authorId: { orderId, authorId } },
    include: { author: { select: { id: true, fullName: true } } },
  });
  if (!review) return null;
  return {
    id: review.id,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    author: { id: review.author.id, name: review.author.fullName },
  };
}

// Avaliações públicas recebidas por um prestador (para o perfil, RF-G2).
export async function listProviderReviews(providerProfileId: string): Promise<ReviewDTO[]> {
  const rows = await prisma.review.findMany({
    where: { order: { providerId: providerProfileId } },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    author: { id: r.author.id, name: r.author.fullName },
  }));
}
