import { randomUUID } from "node:crypto";

import { supabase } from "./db";

export type ReviewDTO = {
  id: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type CreateReviewInput = {
  rating: number;
  comment?: string;
};

async function recomputeProviderRating(providerProfileId: string, providerUserId: string) {
  const { data: orderIds } = await supabase
    .from("order")
    .select("id")
    .eq("providerId", providerProfileId);
  const ids = (orderIds ?? []).map((o) => o.id);
  if (ids.length === 0) {
    await supabase
      .from("providerprofile")
      .update({ ratingAvg: 0, ratingCount: 0, updatedAt: new Date().toISOString() })
      .eq("id", providerProfileId);
    return;
  }
  const { data: reviews } = await supabase
    .from("review")
    .select("rating")
    .eq("targetId", providerUserId)
    .in("orderId", ids);
  const ratings = (reviews ?? []).map((r) => r.rating);
  const ratingCount = ratings.length;
  const ratingAvg = ratingCount === 0 ? 0 : ratings.reduce((a, b) => a + b, 0) / ratingCount;
  await supabase
    .from("providerprofile")
    .update({ ratingAvg, ratingCount, updatedAt: new Date().toISOString() })
    .eq("id", providerProfileId);
}

export async function createReview(
  authorId: string,
  orderId: string,
  input: CreateReviewInput,
): Promise<ReviewDTO | { error: string; status: number }> {
  if (input.rating < 1 || input.rating > 5) {
    return { error: "Nota deve estar entre 1 e 5", status: 400 };
  }

  const { data: order } = await supabase
    .from("order")
    .select("*, provider:providerprofile(id, userId)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const provider = order.provider as unknown as { id: string; userId: string } | null;
  const isClient = order.clientId === authorId;
  const isProvider = provider?.userId === authorId;
  if (!isClient && !isProvider) {
    return { error: "Você não participou deste pedido", status: 403 };
  }
  if (order.status !== "COMPLETED") {
    return { error: "Só é possível avaliar pedidos concluídos", status: 409 };
  }

  const targetId = isClient ? provider?.userId : order.clientId;
  if (!targetId) return { error: "Não há prestador para avaliar", status: 400 };

  const { data: review, error } = await supabase
    .from("review")
    .insert({
      id: randomUUID(),
      orderId,
      authorId,
      targetId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    })
    .select("*, author:user!review_authorId_fkey(id, fullName)")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: "Você já avaliou este pedido", status: 409 };
    }
    throw new Error(error.message);
  }

  if (isClient && provider) {
    await recomputeProviderRating(provider.id, provider.userId);
  }

  const author = review.author as unknown as { id: string; fullName: string };
  return {
    id: review.id,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    author: { id: author.id, name: author.fullName },
  };
}

export async function getMyReview(authorId: string, orderId: string): Promise<ReviewDTO | null> {
  const { data: review } = await supabase
    .from("review")
    .select("*, author:user!review_authorId_fkey(id, fullName)")
    .eq("orderId", orderId)
    .eq("authorId", authorId)
    .maybeSingle();
  if (!review) return null;
  const author = review.author as unknown as { id: string; fullName: string };
  return {
    id: review.id,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    author: { id: author.id, name: author.fullName },
  };
}

export async function listProviderReviews(providerProfileId: string): Promise<ReviewDTO[]> {
  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from("providerprofile").select("userId").eq("id", providerProfileId).maybeSingle(),
    supabase.from("order").select("id").eq("providerId", providerProfileId),
  ]);
  const ids = (orders ?? []).map((o) => o.id);
  if (!profile || ids.length === 0) return [];

  // Só as avaliações RECEBIDAS pelo prestador: nos mesmos pedidos ficam as que
  // ele escreveu sobre os clientes (QA A-10, C-07, P-13).
  const { data: rows } = await supabase
    .from("review")
    .select("*, author:user!review_authorId_fkey(id, fullName)")
    .in("orderId", ids)
    .eq("targetId", profile.userId)
    .order("createdAt", { ascending: false })
    .limit(50);

  return (rows ?? []).map((r) => {
    const author = r.author as unknown as { id: string; fullName: string };
    return {
      id: r.id,
      orderId: r.orderId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      author: { id: author.id, name: author.fullName },
    };
  });
}
