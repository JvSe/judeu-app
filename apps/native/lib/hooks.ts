import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { catalogApi, ordersApi, reviewsApi } from "@/lib/api";
import type { CreateOrderInput, CreateReviewInput, OrderAction } from "@/lib/api";

// Hooks de dados do catálogo (cache via TanStack Query).
export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => catalogApi.categories() });
}

export function useProviders(categoryId?: string) {
  return useQuery({
    queryKey: ["providers", categoryId ?? "all"],
    queryFn: () => catalogApi.providers(categoryId),
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: ["provider", id],
    queryFn: () => catalogApi.provider(id),
    enabled: !!id,
  });
}

// ---- Pedidos ----
export function useOrders(as: "client" | "provider" = "client") {
  return useQuery({ queryKey: ["orders", as], queryFn: () => ordersApi.list(as) });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.get(id),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => ordersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// Avança a máquina de estados e revalida listas + detalhe do pedido.
export function useTransitionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: OrderAction; note?: string }) =>
      ordersApi.transition(id, action, note),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
    },
  });
}

// ---- Avaliações ----
export function useMyReview(orderId: string) {
  return useQuery({
    queryKey: ["review", orderId],
    queryFn: () => reviewsApi.mine(orderId),
    enabled: !!orderId,
  });
}

export function useProviderReviews(providerId: string) {
  return useQuery({
    queryKey: ["provider-reviews", providerId],
    queryFn: () => reviewsApi.forProvider(providerId),
    enabled: !!providerId,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateReviewInput }) =>
      reviewsApi.create(orderId, input),
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: ["review", review.orderId] });
      qc.invalidateQueries({ queryKey: ["provider-reviews"] });
      qc.invalidateQueries({ queryKey: ["provider"] });
    },
  });
}
