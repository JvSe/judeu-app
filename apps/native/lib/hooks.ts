import { useIsFocused } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addressesApi,
  catalogApi,
  chatApi,
  notificationsApi,
  ordersApi,
  paymentsApi,
  profileApi,
  providerProfileApi,
  reviewsApi,
  supportApi,
  walletApi,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  CreateOrderInput,
  CreateReviewInput,
  CreateSupportTicketInput,
  NotificationPreferences,
  OrderAction,
  PaymentMethodOption,
  SavedAddressInput,
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

// ---- Centro de notificações in-app + preferências (RF-I1) ----
// `poll`: refetch curto só em foco (mesmo padrão do chat) — a tela do centro de
// notificações liga; o badge do sino na Home/dashboard só usa o cache/fetch inicial.
export function useNotifications(opts: { poll?: boolean } = {}) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: opts.poll && isFocused ? 8000 : false,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.preferences(),
  });
}

export function useSetNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) => notificationsApi.setPreferences(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });
}

// ---- Central de ajuda/suporte + disputas (RF-H1/H2) ----
export function useSupportTickets() {
  return useQuery({ queryKey: ["support-tickets"], queryFn: () => supportApi.list() });
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => supportApi.get(id),
    enabled: !!id,
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => supportApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}

// ---- Edição de perfil (RF-A6) ----
export function useUpdateProfile() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: (input: { fullName?: string; phone?: string }) => profileApi.update(input),
    onSuccess: updateUser,
  });
}

export function useUploadAvatar() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) =>
      profileApi.uploadAvatar(base64, mimeType),
    onSuccess: updateUser,
  });
}

export function useClientStats() {
  return useQuery({ queryKey: ["client-stats"], queryFn: () => profileApi.stats() });
}

// ---- Livro de endereços do cliente (RF-A6) ----
export function useAddresses() {
  return useQuery({ queryKey: ["addresses"], queryFn: () => addressesApi.list() });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedAddressInput) => addressesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SavedAddressInput> }) =>
      addressesApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });
}
