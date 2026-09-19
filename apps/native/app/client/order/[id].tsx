import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order, OrderStatus } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents, orderStatusLabel, shortDateTime, shortTime } from "@/lib/format";
import { useOrder, useOrderProposals, useRespondToProposal, useTransitionOrder } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";

// Fluxo canônico do pedido (caminho feliz).
const FLOW: { status: OrderStatus; title: string }[] = [
  { status: "CREATED", title: "Pedido criado" },
  { status: "ACCEPTED", title: "Pedido aceito" },
  { status: "EN_ROUTE", title: "Profissional a caminho" },
  { status: "IN_PROGRESS", title: "Serviço em execução" },
  { status: "AWAITING_CONFIRMATION", title: "Aguardando sua confirmação" },
  { status: "COMPLETED", title: "Concluído e pago" },
];

function eventTimeFor(order: Order, status: OrderStatus): string | null {
  const ev = order.events.find((e) => e.status === status);
  return ev ? shortTime(ev.createdAt) : null;
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id, { poll: true });
  const transition = useTransitionOrder();
  const { data: proposals = [] } = useOrderProposals(id);
  const respondToProposal = useRespondToProposal();
  const [respondAction, setRespondAction] = useState<"accept" | "reject" | null>(null);
  const navigatedToPaymentRef = useRef(false);

  // Se a outra parte aceitou a proposta enquanto o cliente estava fora dessa
  // tela, o próximo poll flagra o novo preço e já manda direto pro pagamento.
  useEffect(() => {
    if (!order || order.status !== "CREATED" || order.payment) return;
    if (navigatedToPaymentRef.current) return;
    const accepted = proposals.find((p) => p.status === "ACCEPTED");
    if (!accepted) return;
    navigatedToPaymentRef.current = true;
    router.push({ pathname: "/client/payment/[id]", params: { id: order.id } });
  }, [order, proposals]);

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const cancelled = order.status === "CANCELLED";
  const currentIndex = FLOW.findIndex((f) => f.status === order.status);
  const canCancel = order.status === "CREATED" || order.status === "ACCEPTED";
  const canNegotiate = order.status === "CREATED" && !!order.provider?.allowsNegotiation;
  const pendingProposal = proposals.find((p) => p.status === "PENDING");

  const handleCancel = () => {
    transition.mutate(
      { id: order.id, action: "cancel" },
      {
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível cancelar o pedido."),
      },
    );
  };

  const handleRespondProposal = (action: "accept" | "reject") => {
    if (!pendingProposal) return;
    setRespondAction(action);
    respondToProposal.mutate(
      { orderId: order.id, proposalId: pendingProposal.id, action },
      {
        onSuccess: () => {
          if (action === "accept" && !navigatedToPaymentRef.current) {
            navigatedToPaymentRef.current = true;
            router.push({ pathname: "/client/payment/[id]", params: { id: order.id } });
          }
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível responder à proposta."),
        onSettled: () => setRespondAction(null),
      },
    );
  };

  const handleConfirmCompletion = () => {
    transition.mutate(
      { id: order.id, action: "confirm_completion" },
      {
        onSuccess: () => router.push({ pathname: "/client/rating/[id]", params: { id: order.id } }),
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível confirmar a conclusão."),
      },
    );
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Pedido #{order.id.slice(0, 6)}</Text>
        </View>
        <View style={[styles.statusBadge, cancelled && styles.statusBadgeCancelled]}>
          <Text style={[styles.statusBadgeText, cancelled && styles.statusBadgeTextCancelled]}>
            {orderStatusLabel(order.status).toUpperCase()}
          </Text>
        </View>
      </View>

      {canNegotiate && pendingProposal?.byRole === "provider" && (
        <View style={styles.negotiationBannerWrap}>
          <View style={styles.negotiationCard}>
            <Text style={styles.negotiationLabel}>O prestador propôs um novo valor</Text>
            <Text style={styles.negotiationValue}>{moneyFromCents(pendingProposal.priceCents)}</Text>
            {pendingProposal.note && (
              <Text style={styles.negotiationNote}>“{pendingProposal.note}”</Text>
            )}
            <View style={styles.negotiationActions}>
              <SpinButton
                controlled
                isActive={respondAction === "reject" && respondToProposal.isPending}
                disabled={respondToProposal.isPending}
                idleText="Recusar"
                activeText="Recusando..."
                onPress={() => handleRespondProposal("reject")}
                colors={{
                  idle: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                  active: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                }}
                buttonStyle={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13, fontSize: 13 }}
                spinnerConfig={{ color: theme.colors.mutedForeground, containerBackground: "rgba(255,255,255,0.06)" }}
              />
              <View style={{ flex: 1 }}>
                <SpinButton
                  controlled
                  isActive={respondAction === "accept" && respondToProposal.isPending}
                  disabled={respondToProposal.isPending}
                  idleText={`Aceitar ${moneyFromCents(pendingProposal.priceCents)}`}
                  activeText="Aceitando..."
                  onPress={() => handleRespondProposal("accept")}
                  colors={{
                    idle: { background: theme.colors.primary, text: "#fff" },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13, fontSize: 13 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {canNegotiate && pendingProposal?.byRole === "client" && (
        <View style={styles.negotiationBannerWrap}>
          <View style={styles.negotiationCard}>
            <Text style={styles.negotiationLabel}>Sua proposta</Text>
            <Text style={styles.negotiationValue}>{moneyFromCents(pendingProposal.priceCents)}</Text>
            <Text style={styles.negotiationWaiting}>Aguardando resposta do prestador…</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.providerCard}>
          <Avatar
            initials={initialsOf(order.provider?.name ?? "?")}
            color={theme.colors.primary}
            size={52}
            radius={15}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{order.provider?.name ?? "Prestador"}</Text>
            <View style={styles.providerMetaRow}>
              <View style={styles.ratingChip}>
                <Text style={styles.ratingText}>★ {(order.provider?.ratingAvg ?? 0).toFixed(1)}</Text>
              </View>
              <Text style={styles.providerMeta}>{order.provider?.headline ?? "Serviço"}</Text>
            </View>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push({ pathname: "/client/chat/[id]", params: { id: order.id } })}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          </Pressable>
        </View>

        {order.scheduledAt && (
          <View style={styles.scheduleCard}>
            <Ionicons name="calendar" size={17} color={theme.colors.primary} />
            <Text style={styles.scheduleText}>Agendado para {shortDateTime(order.scheduledAt)}</Text>
          </View>
        )}

        {(order.status === "ACCEPTED" || order.status === "EN_ROUTE") && (
          <Pressable
            style={styles.trackButton}
            onPress={() => router.push({ pathname: "/client/tracking/[id]", params: { id: order.id } })}
          >
            <Ionicons name="navigate" size={17} color="#fff" />
            <Text style={styles.trackButtonText}>Acompanhar no mapa</Text>
          </Pressable>
        )}

        {order.status === "IN_PROGRESS" && (
          <Pressable
            style={styles.trackButtonLocal}
            onPress={() => router.push({ pathname: "/client/tracking/[id]", params: { id: order.id } })}
          >
            <Ionicons name="location" size={17} color={theme.colors.success} />
            <Text style={styles.trackButtonLocalText}>Prestador no local — ver no mapa</Text>
          </Pressable>
        )}

        {cancelled ? (
          <View style={styles.cancelledCard}>
            <Ionicons name="close-circle" size={20} color={theme.colors.destructive} />
            <Text style={styles.cancelledText}>
              {order.cancelReason ?? "Pedido cancelado."}
            </Text>
          </View>
        ) : (
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Andamento</Text>
            {FLOW.map((step, index) => {
              const last = index === FLOW.length - 1;
              const state =
                index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
              const time = eventTimeFor(order, step.status);
              return (
                <View key={step.status} style={styles.timelineRow}>
                  <View style={styles.timelineTrack}>
                    <View
                      style={[
                        styles.timelineDot,
                        state === "done" && styles.timelineDotDone,
                        state === "active" && styles.timelineDotActive,
                        state === "pending" && styles.timelineDotPending,
                      ]}
                    >
                      {state === "done" && <Ionicons name="checkmark" size={12} color="#fff" />}
                      {state === "active" && <View style={styles.timelineDotInner} />}
                    </View>
                    {!last && (
                      <View
                        style={[styles.timelineLine, state === "done" && styles.timelineLineDone]}
                      />
                    )}
                  </View>
                  <View style={[styles.timelineContent, last && { paddingBottom: 0 }]}>
                    <Text
                      style={[
                        styles.timelineStepTitle,
                        state === "active" && styles.timelineStepTitleActive,
                        state === "pending" && styles.timelineStepTitlePending,
                      ]}
                    >
                      {step.title}
                    </Text>
                    {time && <Text style={styles.timelineMeta}>{time}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.costCard}>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>{order.service?.name ?? "Serviço"}</Text>
            <Text style={styles.costValue}>{moneyFromCents(order.priceCents)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Taxa de serviço</Text>
            <Text style={styles.costValue}>{moneyFromCents(order.platformFeeCents)}</Text>
          </View>
          <View style={styles.costDivider} />
          <View style={styles.costRow}>
            <Text style={styles.costTotalLabel}>Total</Text>
            <Text style={styles.costTotalValue}>{moneyFromCents(order.totalCents)}</Text>
          </View>
        </View>

        {order.status === "CREATED" && (
          <Pressable
            style={styles.payButton}
            onPress={() => router.push({ pathname: "/client/payment/[id]", params: { id: order.id } })}
          >
            <Ionicons name="card-outline" size={17} color="#fff" />
            <Text style={styles.payButtonText}>Ir para pagamento</Text>
          </Pressable>
        )}

        {order.status === "AWAITING_CONFIRMATION" && (
          <View style={{ marginBottom: 16 }}>
            <SpinButton
              controlled
              isActive={transition.isPending}
              disabled={transition.isPending}
              idleText="Confirmar conclusão do serviço"
              activeText="Confirmando..."
              onPress={handleConfirmCompletion}
              colors={{
                idle: { background: theme.colors.primary, text: "#fff" },
                active: { background: theme.colors.primary, text: "#fff" },
              }}
              buttonStyle={{ paddingVertical: 14, borderRadius: 16, fontSize: 14.5 }}
              spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
            />
          </View>
        )}

        {canNegotiate && !pendingProposal && (
          <Pressable
            style={styles.negotiateLink}
            onPress={() => router.push({ pathname: "/client/propose/[id]", params: { id: order.id } })}
          >
            <Ionicons name="pricetag-outline" size={15} color="#FF9a52" />
            <Text style={styles.negotiateLinkText}>Negociar valor</Text>
          </Pressable>
        )}

        <View style={styles.addressCard}>
          <Ionicons name="location" size={18} color={theme.colors.primary} />
          <Text style={styles.addressText}>
            {order.address.street}
            {order.address.number ? `, ${order.address.number}` : ""}
            {order.address.neighborhood ? ` · ${order.address.neighborhood}` : ""} ·{" "}
            {order.address.city}/{order.address.state}
          </Text>
        </View>

        {canCancel && (
          <Pressable onPress={handleCancel} disabled={transition.isPending}>
            <Text style={styles.cancelText}>
              {transition.isPending ? "Cancelando..." : "Cancelar pedido"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() =>
            router.push({ pathname: "/client/support-ticket-new", params: { orderId: order.id } })
          }
        >
          <Text style={styles.reportText}>Reportar um problema com esse pedido</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerTitle: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  statusBadge: {
    backgroundColor: "rgba(255,102,0,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeCancelled: {
    backgroundColor: "rgba(255,107,107,0.15)",
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  statusBadgeTextCancelled: {
    color: "#ff6b6b",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 40,
  },
  negotiationBannerWrap: {
    paddingHorizontal: 24,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 17,
    marginBottom: 16,
  },
  providerName: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  providerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  ratingChip: {
    backgroundColor: "rgba(255,102,0,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  providerMeta: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,102,0,0.1)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  scheduleText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  trackButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  trackButtonLocal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(49,208,127,0.12)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.35)",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  trackButtonLocalText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  cancelledCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,107,107,0.1)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  cancelledText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#ff6b6b",
    lineHeight: 18,
  },
  timelineCard: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 19,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 14.5,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
  },
  timelineTrack: {
    alignItems: "center",
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: theme.colors.success,
  },
  timelineDotActive: {
    backgroundColor: theme.colors.primary,
  },
  timelineDotPending: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  timelineLine: {
    width: 2.5,
    flex: 1,
    minHeight: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  timelineLineDone: {
    backgroundColor: theme.colors.success,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 18,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  timelineStepTitleActive: {
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  timelineStepTitlePending: {
    color: "#6b699a",
  },
  timelineMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  costCard: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 17,
    marginBottom: 16,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  costLabel: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  costValue: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  costDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 2,
    marginBottom: 12,
  },
  costTotalLabel: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  costTotalValue: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  payButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  negotiationCard: {
    backgroundColor: "rgba(255,102,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  negotiationLabel: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  negotiationValue: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 4,
  },
  negotiationNote: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    marginTop: 6,
    lineHeight: 18,
  },
  negotiationWaiting: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 6,
  },
  negotiationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  negotiateLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 16,
  },
  negotiateLinkText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 18,
    padding: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#e8e8f5",
    lineHeight: 18,
  },
  cancelText: {
    textAlign: "center",
    marginTop: 18,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#ff6b6b",
  },
  reportText: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
}));
