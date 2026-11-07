import { useIsFocused } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import notifee from "react-native-notify-kit";

import {
  DEFAULT_APP_CONFIG,
  addressesApi,
  catalogApi,
  configApi,
  familyApi,
  chatApi,
  jobsApi,
  notificationsApi,
  ordersApi,
  paymentsApi,
  payoutsApi,
  profileApi,
  proposalsApi,
  providerProfileApi,
  reviewsApi,
  supportApi,
  walletApi,
} from "@/lib/api";
import { INCOMING_HELP_CHANNEL, INCOMING_HELP_SOUND_FILE } from "@/lib/push";
import { saveTokens } from "@/lib/tokens";
import { useAuth } from "@/lib/auth-context";
import type {
  CreateJobPostingInput,
  CreateOrderInput,
  CreateProposalInput,
  CreateReviewInput,
  CreateSupportTicketInput,
  ArrangeOrderInput,
  JobFilters,
  JobStatusValue,
  KycFileKind,
  NotificationPreferences,
  OrderAction,
  PaymentMethodOption,
  SavedAddressInput,
  UpsertProviderProfileInput,
} from "@/lib/api";

// Configuração pública da API (taxa, TTLs). Nunca fica vazia: até a resposta
// chegar (ou se ela falhar), vale DEFAULT_APP_CONFIG.
export function useAppConfig() {
  const query = useQuery({
    queryKey: ["app-config"],
    queryFn: () => configApi.get(),
    staleTime: 5 * 60_000,
  });
  return query.data ?? DEFAULT_APP_CONFIG;
}

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

export function useNearbyProviders(
  origin: { lat: number; lng: number } | null,
  opts: { categoryId?: string; excludeProviderId?: string } = {},
) {
  return useQuery({
    queryKey: [
      "providers-nearby",
      origin?.lat,
      origin?.lng,
      opts.categoryId ?? "all",
      opts.excludeProviderId ?? "",
    ],
    queryFn: () =>
      catalogApi.nearby({
        lat: origin!.lat,
        lng: origin!.lng,
        categoryId: opts.categoryId,
        excludeProviderId: opts.excludeProviderId,
      }),
    enabled: origin != null,
    refetchInterval: 15_000,
  });
}

// "N pessoas perto, ~X min" antes de publicar uma ajuda aberta (mesmo público do push).
export function useOpenRequestAvailability(
  point: { lat: number; lng: number } | null,
  categoryId?: string,
) {
  return useQuery({
    queryKey: ["open-request-availability", point?.lat, point?.lng, categoryId ?? "all"],
    queryFn: () => ordersApi.availability({ lat: point!.lat, lng: point!.lng, categoryId }),
    enabled: point != null,
    refetchInterval: 20_000,
  });
}

// Valor inicial sugerido para ajuda aberta (mediana por categoria + horário).
export function useSuggestedPrice(categoryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["suggested-price", categoryId ?? "all"],
    queryFn: () => ordersApi.suggestedPrice(categoryId),
    enabled,
    staleTime: 10 * 60_000,
  });
}

// Busca do catálogo (aba Buscar). Termos com menos de 2 caracteres não vão à rede.
export function useCatalogSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["catalog-search", q],
    queryFn: () => catalogApi.search(q),
    enabled: q.length >= 2,
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
// `poll` liga refetch curto (só em foco) — usado onde o badge de chat não lido precisa se atualizar sozinho.
export function useOrders(
  as: "client" | "provider" = "client",
  opts: { poll?: boolean; enabled?: boolean } = {},
) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["orders", as],
    queryFn: () => ordersApi.list(as),
    enabled: opts.enabled !== false,
    refetchInterval: opts.poll && isFocused ? 8000 : false,
  });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["providers-nearby"] });
    },
  });
}

export function useArrangeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & ArrangeOrderInput) =>
      ordersApi.arrange(id, input),
    onSuccess: (order) => {
      qc.setQueryData(["order", order.id], order);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// Avança a máquina de estados e revalida listas + detalhe do pedido.
export function useTransitionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      note,
      doorCode,
    }: {
      id: string;
      action: OrderAction;
      note?: string;
      doorCode?: string;
    }) => ordersApi.transition(id, action, note, doorCode),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

// Código de chegada do pedido (só o cliente). Atualiza para refletir bloqueio por tentativas.
export function useDoorCode(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["door-code", orderId],
    queryFn: () => ordersApi.doorCode(orderId),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useRegenerateDoorCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => ordersApi.regenerateDoorCode(orderId),
    onSuccess: (data, orderId) => qc.setQueryData(["door-code", orderId], data),
  });
}

// ---- Modo família ----
export function useTrustedContact() {
  return useQuery({ queryKey: ["trusted-contact"], queryFn: () => familyApi.getContact() });
}

export function useSetTrustedContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: familyApi.setContact,
    onSuccess: (contact) => qc.setQueryData(["trusted-contact"], contact),
  });
}

export function useOrderShare(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["order-share", orderId],
    queryFn: () => familyApi.orderShare(orderId),
    enabled,
  });
}

// Prestador reporta a posição atual enquanto o pedido está a caminho (RF-E3).
export function useUpdateOrderLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: string; lat: number; lng: number }) =>
      ordersApi.updateLocation(id, lat, lng),
    onSuccess: (order) => {
      qc.setQueryData(["order", order.id], order);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// ---- Orçamento/negociação antes do aceite (RF-D5) ----
// Poll curto só em foco (mesmo padrão do chat) — a outra parte pode responder a
// qualquer momento enquanto o pedido segue CREATED.
export function useOrderProposals(orderId: string) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["order-proposals", orderId],
    queryFn: () => proposalsApi.list(orderId),
    enabled: !!orderId,
    refetchInterval: isFocused ? 5000 : false,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateProposalInput }) =>
      proposalsApi.create(orderId, input),
    onSuccess: (_proposal, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["order-proposals", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
}

export function useRespondToProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      proposalId,
      action,
    }: {
      orderId: string;
      proposalId: string;
      action: "accept" | "reject";
    }) => proposalsApi.respond(orderId, proposalId, action),
    onSuccess: (_proposal, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["order-proposals", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
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
      // Atualiza cache na hora para a tela de pagamento redirecionar sem esperar o poll.
      qc.setQueryData(["payment", orderId], result.payment);
      qc.invalidateQueries({ queryKey: ["payment", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentsApi.confirm(orderId),
    onSuccess: (payment, orderId) => {
      const snapshot = { status: payment.status, method: payment.method };
      qc.setQueryData(["payment", orderId], payment);
      qc.setQueryData(["order", orderId], (current: { payment?: unknown } | undefined) =>
        current ? { ...current, payment: snapshot } : current,
      );
      for (const as of ["client", "provider"] as const) {
        qc.setQueryData(["orders", as], (list: { id: string; payment?: unknown }[] | undefined) =>
          list?.map((item) => (item.id === orderId ? { ...item, payment: snapshot } : item)),
        );
      }
      qc.invalidateQueries({ queryKey: ["payment", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// ---- Carteira do prestador ----
export function useWallet() {
  return useQuery({ queryKey: ["wallet"], queryFn: () => walletApi.summary() });
}

// ---- Saque Pix ----
export function usePayoutOverview() {
  return useQuery({ queryKey: ["payouts"], queryFn: () => payoutsApi.overview() });
}

// "Como fica depois do saque" para um valor digitado (0 = não consulta).
export function usePayoutPreview(amountCents: number) {
  return useQuery({
    queryKey: ["payout-preview", amountCents],
    queryFn: () => payoutsApi.preview(amountCents),
    enabled: amountCents > 0,
    placeholderData: (prev) => prev,
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountCents: number) => payoutsApi.request(amountCents),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["payouts"] });
      void qc.invalidateQueries({ queryKey: ["payout-preview"] });
    },
  });
}

export function useSavePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payoutsApi.saveAccount,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payouts"] }),
  });
}

// ---- Cadastro profissional + KYC do prestador ----
export function useMyProviderProfile() {
  const { user } = useAuth();
  const canHaveProfile = user?.role === "PROVIDER" || user?.role === "BOTH";
  return useQuery({
    // user.id no key evita reusar perfil de outra conta no mesmo processo JS
    queryKey: ["provider-profile", "me", user?.id ?? "anonymous"],
    queryFn: () => providerProfileApi.me(),
    enabled: canHaveProfile,
  });
}

export function useUpsertProviderProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: UpsertProviderProfileInput) => providerProfileApi.upsert(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["provider-profile", "me", user?.id ?? "anonymous"] }),
  });
}

export function useUploadProviderDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) =>
      providerProfileApi.uploadDocument(base64, mimeType),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["provider-profile", "me", user?.id ?? "anonymous"] }),
  });
}

// KYC v2: documento, selfie (câmera) e antecedentes.
export function useUploadKycFile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ kind, base64, mimeType }: { kind: KycFileKind; base64: string; mimeType: string }) =>
      providerProfileApi.uploadKycFile(kind, base64, mimeType),
    onSuccess: (profile) => qc.setQueryData(["provider-profile", "me", user?.id ?? "anonymous"], profile),
  });
}

// Liga/desliga a disponibilidade do prestador para receber pedidos (RF-B4).
export function useSetAvailability() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (isAvailable: boolean) => providerProfileApi.setAvailability(isAvailable),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-profile", "me", user?.id ?? "anonymous"] });
      // Ajuda aberta depende da posição/disponibilidade — força lista fresca.
      qc.invalidateQueries({ queryKey: ["orders", "provider"] });
    },
  });
}

export function useUpdateProviderLocation() {
  return useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) =>
      providerProfileApi.updateLocation(lat, lng),
  });
}

// Edita bio/raio de quem atende ajudas (helper). A resposta já é o perfil novo.
export function useUpdateHelperProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { bio?: string; serviceRadiusKm?: number }) =>
      providerProfileApi.updateHelper(input),
    onSuccess: (profile) =>
      qc.setQueryData(["provider-profile", "me", user?.id ?? "anonymous"], profile),
  });
}

// Cliente passa a atender ajudas (role CLIENT -> BOTH): troca os tokens, atualiza o
// usuário em memória e semeia o cache do perfil com o que o backend devolveu.
export function useRegisterHelper() {
  const qc = useQueryClient();
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: (input: Parameters<typeof providerProfileApi.registerHelper>[0]) =>
      providerProfileApi.registerHelper(input),
    onSuccess: async (res) => {
      await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      updateUser(res.user);
      qc.setQueryData(["provider-profile", "me", res.user.id], res.profile);
    },
  });
}

export function useReassignOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, providerId }: { id: string; providerId: string }) =>
      ordersApi.reassign(id, providerId),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      qc.invalidateQueries({ queryKey: ["providers-nearby"] });
    },
  });
}

// ---- Centro de notificações in-app + preferências (RF-I1) ----
// `poll`: refetch curto só em foco (mesmo padrão do chat) — a tela do centro de
// notificações liga; o badge do sino na Home/dashboard só usa o cache/fetch inicial.
export function useNotifications(opts: { poll?: boolean } = {}) {
  const isFocused = useIsFocused();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: opts.poll && isFocused ? 8000 : false,
  });

  // Exibe via notifee cada notificação nova que chegar enquanto a tela do centro
  // de notificações está aberta — não depende do push remoto (funciona mesmo
  // sem device físico/token registrado, já que só olha a lista já buscada).
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!opts.poll) return;
    const items = query.data?.notifications;
    if (!items) return;
    if (!seenIds.current) {
      seenIds.current = new Set(items.map((item) => item.id));
      return;
    }
    for (const item of items) {
      if (seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      const isOrder = item.type === "ORDER" || item.data?.type === "order";
      notifee.displayNotification({
        title: item.title,
        body: item.body,
        data: (item.data ?? undefined) as Record<string, string | number | object> | undefined,
        android: {
          channelId: isOrder ? INCOMING_HELP_CHANNEL : "default",
          pressAction: { id: "default" },
        },
        ios: { sound: isOrder ? INCOMING_HELP_SOUND_FILE : "default" },
      });
    }
  }, [opts.poll, query.data]);

  return query;
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

// ---- Vagas de emprego: candidato (busca/aplica) ----
export function useJobs(filters: JobFilters = {}) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () => jobsApi.list(filters),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: () => jobsApi.get(id),
    enabled: !!id,
  });
}

export function useApplyToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) => jobsApi.apply(id, message),
    onSuccess: (_application, { id }) => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["my-job-applications"] });
    },
  });
}

export function useMyApplications() {
  return useQuery({ queryKey: ["my-job-applications"], queryFn: () => jobsApi.myApplications() });
}

// ---- Vagas de emprego: empresa (publica/gerencia) ----
export function useMyJobPostings(enabled = true) {
  return useQuery({
    queryKey: ["job-postings", "mine"],
    queryFn: () => jobsApi.mine(),
    enabled,
  });
}

export function useMyJobPosting(id: string) {
  return useQuery({
    queryKey: ["job-posting", id],
    queryFn: () => jobsApi.getMine(id),
    enabled: !!id,
  });
}

export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobPostingInput) => jobsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings", "mine"] }),
  });
}

export function useSetJobPostingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatusValue }) =>
      jobsApi.setStatus(id, status),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["job-postings", "mine"] });
      qc.invalidateQueries({ queryKey: ["job-posting", job.id] });
    },
  });
}

// Poll curto só em foco (mesmo padrão de useOrders) — a empresa acompanha novas candidaturas.
export function useJobApplicants(jobId: string) {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ["job-applicants", jobId],
    queryFn: () => jobsApi.applicants(jobId),
    enabled: !!jobId,
    refetchInterval: isFocused ? 8000 : false,
  });
}

export function useRespondToApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      applicationId,
      action,
    }: {
      jobId: string;
      applicationId: string;
      action: "accept" | "reject";
    }) => jobsApi.respond(jobId, applicationId, action),
    onSuccess: (_application, { jobId }) => {
      qc.invalidateQueries({ queryKey: ["job-applicants", jobId] });
      qc.invalidateQueries({ queryKey: ["job-postings", "mine"] });
    },
  });
}
