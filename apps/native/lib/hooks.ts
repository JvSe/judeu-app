import { useIsFocused } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  catalogApi,
  chatApi,
  ordersApi,
  paymentsApi,
  providerProfileApi,
  reviewsApi,
  walletApi,
} from "@/lib/api";
import type {
  CreateOrderInput,
  CreateReviewInput,
  OrderAction,
  PaymentMethodOption,
  UpsertProviderProfileInput,
} from "@/lib/api";

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

// `poll` liga refetch curto (só em foco) — usado no acompanhamento em tempo real (RF-E3).
export function useOrder(id: string, opts: { poll?: boolean } = {}) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.get(id),
    enabled: !!id,
    refetchInterval: opts.poll && isFocused ? 5000 : false,
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
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

// Prestador reporta a posição atual enquanto o pedido está a caminho (RF-E3).
export function useUpdateOrderLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: string; lat: number; lng: number }) =>
      ordersApi.updateLocation(id, lat, lng),
    onSuccess: (order) => qc.invalidateQueries({ queryKey: ["order", order.id] }),
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

// ---- Chat ----
// Poll curto só com a tela em foco — sem Supabase Realtime (app nunca fala direto com o Supabase).
export function useMessages(orderId: string) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["messages", orderId],
    queryFn: () => chatApi.list(orderId),
    enabled: !!orderId,
    refetchInterval: isFocused ? 4000 : false,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: string }) =>
      chatApi.send(orderId, body),
    onSuccess: (message) => qc.invalidateQueries({ queryKey: ["messages", message.orderId] }),
  });
}

// ---- Pagamento ----
// Poll curto enquanto aguarda confirmação (Pix/cartão); some quando já está PAID.
export function useOrderPayment(orderId: string) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["payment", orderId],
    queryFn: () => paymentsApi.get(orderId),
    enabled: !!orderId,
    refetchInterval: (query) => (isFocused && query.state.data?.status !== "PAID" ? 4000 : false),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: PaymentMethodOption }) =>
      paymentsApi.create(orderId, method),
    onSuccess: (result, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["payment", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
}

// ---- Carteira do prestador ----
export function useWallet() {
  return useQuery({ queryKey: ["wallet"], queryFn: () => walletApi.summary() });
}

// ---- Cadastro profissional + KYC do prestador ----
export function useMyProviderProfile() {
  return useQuery({ queryKey: ["provider-profile", "me"], queryFn: () => providerProfileApi.me() });
}

export function useUpsertProviderProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertProviderProfileInput) => providerProfileApi.upsert(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-profile", "me"] }),
  });
}

export function useUploadProviderDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) =>
      providerProfileApi.uploadDocument(base64, mimeType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-profile", "me"] }),
  });
}

// Liga/desliga a disponibilidade do prestador para receber pedidos (RF-B4).
export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isAvailable: boolean) => providerProfileApi.setAvailability(isAvailable),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-profile", "me"] }),
  });
}
