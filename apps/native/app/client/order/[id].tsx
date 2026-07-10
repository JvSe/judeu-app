import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order, OrderStatus } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents, orderStatusLabel, shortDateTime, shortTime } from "@/lib/format";
import { useOrder, useTransitionOrder } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

// Fluxo canônico do pedido (caminho feliz).
const FLOW: { status: OrderStatus; title: string }[] = [
  { status: "CREATED", title: "Pedido criado" },
  { status: "ACCEPTED", title: "Pedido aceito" },
  { status: "EN_ROUTE", title: "Profissional a caminho" },
  { status: "IN_PROGRESS", title: "Serviço em execução" },
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

  const handleCancel = () => {
    transition.mutate({ id: order.id, action: "cancel" });
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
