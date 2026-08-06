import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order, OrderAction } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { initialsOf, moneyFromCents, orderStatusLabel, shortDateTime, shortTime } from "@/lib/format";
import {
  useMyProviderProfile,
  useNotifications,
  useOrders,
  useSetAvailability,
  useTransitionOrder,
} from "@/lib/hooks";
import { useShareLocationWhileEnRoute } from "@/lib/location";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";

function orderTitle(order: Order): string {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

// Próxima ação do prestador para um pedido já aceito. Em EN_ROUTE, só libera
// "Iniciar serviço" quando a posição do prestador chegou perto do cliente.
function nextAction(order: Order): { action: OrderAction; label: string; disabled?: boolean } | null {
  switch (order.status) {
    case "ACCEPTED":
      return { action: "start_route", label: "Iniciar trajeto" };
    case "EN_ROUTE":
      return order.tracking.arrived
        ? { action: "start_work", label: "Iniciar serviço" }
        : { action: "start_work", label: "Aguardando chegada...", disabled: true };
    case "IN_PROGRESS":
      return { action: "complete", label: "Concluir serviço" };
    default:
      return null;
  }
}

export default function ProviderDashboard() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const { data: profile } = useMyProviderProfile();
  const { data: orders = [], isLoading } = useOrders("provider", { poll: true });
  const transition = useTransitionOrder();
  const setAvailability = useSetAvailability();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;
  const [pendingOrder, setPendingOrder] = useState<{ id: string; action: OrderAction } | null>(null);

  const newOrders = orders.filter((o) => o.status === "CREATED");
  const activeOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE" || o.status === "IN_PROGRESS",
  );
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const enRouteOrder = activeOrders.find(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE",
  );
  useShareLocationWhileEnRoute(enRouteOrder?.id);

  const act = (id: string, action: OrderAction) => {
    setPendingOrder({ id, action });
    transition.mutate(
      { id, action },
      {
        onSuccess: (order) => {
          if (action === "start_route") {
            router.push({ pathname: "/provider/delivery/[id]", params: { id: order.id } });
          }
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível completar a ação."),
        onSettled: () => setPendingOrder(null),
      },
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Avatar initials={initialsOf(user?.fullName ?? "?")} size={46} radius={14} />
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Bem-vindo,</Text>
            <Text style={styles.name}>{user?.fullName ?? "Prestador"}</Text>
          </View>
          <Pressable onPress={() => router.push("/provider/notifications" as never)} hitSlop={8}>
            <View style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.foreground} />
              {hasUnread && <View style={styles.bellDot} />}
            </View>
          </Pressable>
          <SpinButton
            controlled
            isActive={setAvailability.isPending}
            disabled={setAvailability.isPending}
            idleText={profile?.isAvailable ? "Disponível" : "Offline"}
            activeText="Atualizando..."
            onPress={() => setAvailability.mutate(!profile?.isAvailable)}
            colors={{
              idle: {
                background: profile?.isAvailable ? "rgba(49,208,127,0.14)" : "rgba(255,255,255,0.07)",
                text: profile?.isAvailable ? theme.colors.success : theme.colors.mutedForeground,
              },
              active: {
                background: "rgba(255,102,0,0.14)",
                text: theme.colors.primary,
              },
            }}
            buttonStyle={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 12,
              fontSize: 12.5,
            }}
            spinnerConfig={{
              size: 12,
              strokeWidth: 1.6,
              containerSize: 16,
              containerBackground: "rgba(255,102,0,0.14)",
              position: { right: -2, bottom: 5 },
            }}
          />
        </View>

        {profile && profile.status !== "APPROVED" && (
          <Pressable
            style={[
              styles.statusBanner,
              profile.status === "BLOCKED" && styles.statusBannerBlocked,
            ]}
            onPress={() => router.push("/provider/kyc")}
          >
            <Ionicons
              name={profile.status === "BLOCKED" ? "close-circle" : "time-outline"}
              size={20}
              color={profile.status === "BLOCKED" ? theme.colors.destructive : theme.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusBannerTitle}>
                {profile.status === "BLOCKED"
                  ? "Cadastro bloqueado"
                  : profile.headline
                    ? "Cadastro em análise"
                    : "Complete seu cadastro profissional"}
              </Text>
              <Text style={styles.statusBannerText}>
                {profile.status === "BLOCKED"
                  ? "Fale com o suporte para entender o motivo."
                  : "Você só aparece para clientes depois da aprovação."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        )}

        <LinearGradient colors={["#FF6600", "#d94f00"]} style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Pedidos ativos</Text>
          <Text style={styles.earningsValue}>{activeOrders.length}</Text>
          <View style={styles.earningsStatsRow}>
            <View>
              <Text style={styles.earningsStatValue}>{newOrders.length}</Text>
              <Text style={styles.earningsStatLabel}>Novos</Text>
            </View>
            <View>
              <Text style={styles.earningsStatValue}>
                {orders.filter((o) => o.status === "COMPLETED").length}
              </Text>
              <Text style={styles.earningsStatLabel}>Concluídos</Text>
            </View>
            <View>
              <Text style={styles.earningsStatValue}>{orders.length}</Text>
              <Text style={styles.earningsStatLabel}>Total</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Novos pedidos</Text>
          {newOrders.length > 0 && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{newOrders.length} novos</Text>
            </View>
          )}
        </View>

        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />}
        {!isLoading && newOrders.length === 0 && (
          <Text style={styles.emptyText}>Nenhum pedido novo no momento.</Text>
        )}

        {newOrders.map((order) => (
          <View key={order.id} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={styles.requestIcon}>
                <Ionicons name="flash" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>{orderTitle(order)}</Text>
                <Text style={styles.requestMeta}>
                  {order.client.name} · {shortTime(order.createdAt)}
                </Text>
              </View>
              <Text style={styles.requestPrice}>{moneyFromCents(order.totalCents)}</Text>
            </View>
            {order.scheduledAt && (
              <View style={styles.scheduledChip}>
                <Ionicons name="calendar" size={13} color={theme.colors.primary} />
                <Text style={styles.scheduledChipText}>
                  Agendado para {shortDateTime(order.scheduledAt)}
                </Text>
              </View>
            )}
            {order.description && <Text style={styles.requestDesc}>{order.description}</Text>}
            {profile?.allowsNegotiation && (
              <Pressable
                style={styles.proposeButton}
                onPress={() => router.push({ pathname: "/provider/propose/[id]", params: { id: order.id } })}
              >
                <Ionicons name="pricetag-outline" size={14} color="#FF9a52" />
                <Text style={styles.proposeButtonText}>Propor outro valor</Text>
              </Pressable>
            )}
            <View style={styles.requestActions}>
              <SpinButton
                controlled
                isActive={
                  transition.isPending && pendingOrder?.id === order.id && pendingOrder.action === "reject"
                }
                disabled={transition.isPending}
                idleText="Recusar"
                activeText="Recusando..."
                onPress={() => act(order.id, "reject")}
                colors={{
                  idle: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                  active: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                }}
                buttonStyle={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13, fontSize: 13.5 }}
                spinnerConfig={{ color: theme.colors.mutedForeground, containerBackground: "rgba(255,255,255,0.06)" }}
              />
              <View style={{ flex: 1 }}>
                <SpinButton
                  controlled
                  isActive={
                    transition.isPending && pendingOrder?.id === order.id && pendingOrder.action === "accept"
                  }
                  disabled={transition.isPending}
                  idleText="Aceitar pedido"
                  activeText="Aceitando..."
                  onPress={() => act(order.id, "accept")}
                  colors={{
                    idle: { background: theme.colors.primary, text: "#fff" },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13, fontSize: 14.5 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        ))}

        {activeOrders.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Em andamento</Text>
          </View>
        )}

        {activeOrders.map((order) => {
          const next = nextAction(order);
          return (
            <View key={order.id} style={styles.activeCard}>
              <View style={styles.requestHeader}>
                <Avatar initials={initialsOf(order.client.name)} color="#3a3a70" size={44} radius={13} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTitle}>{orderTitle(order)}</Text>
                  <Text style={styles.requestMeta}>{order.client.name}</Text>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>{orderStatusLabel(order.status)}</Text>
                </View>
                <Pressable
                  style={styles.chatIconButton}
                  onPress={() =>
                    router.push({ pathname: "/provider/chat/[id]", params: { id: order.id } })
                  }
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                  {order.unreadMessages > 0 && (
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeText}>
                        {order.unreadMessages > 9 ? "9+" : order.unreadMessages}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
              {next && (
                <SpinButton
                  controlled
                  isActive={
                    transition.isPending &&
                    pendingOrder?.id === order.id &&
                    pendingOrder.action === next.action
                  }
                  disabled={transition.isPending || next.disabled}
                  idleText={next.label}
                  activeText="Atualizando..."
                  onPress={() => act(order.id, next.action)}
                  colors={{
                    idle: {
                      background: next.disabled ? "rgba(255,255,255,0.07)" : theme.colors.primary,
                      text: "#fff",
                    },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13, fontSize: 14.5 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              )}
              {(order.status === "ACCEPTED" || order.status === "EN_ROUTE") && (
                <Pressable
                  style={styles.mapLink}
                  onPress={() =>
                    router.push({ pathname: "/provider/delivery/[id]", params: { id: order.id } })
                  }
                >
                  <Ionicons name="navigate" size={16} color={theme.colors.primary} />
                  <Text style={styles.mapLinkText}>Ir para o mapa</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {completedOrders.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Concluídos</Text>
          </View>
        )}

        {completedOrders.slice(0, 10).map((order) => (
          <Pressable
            key={order.id}
            style={({ pressed }) => [styles.completedRow, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() =>
              router.push({ pathname: "/provider/rating/[id]", params: { id: order.id } })
            }
          >
            <Avatar initials={initialsOf(order.client.name)} color="#3a3a70" size={44} radius={13} />
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>{orderTitle(order)}</Text>
              <Text style={styles.requestMeta}>{order.client.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.requestPrice}>{moneyFromCents(order.totalCents)}</Text>
              <Text style={styles.rateCta}>★ avaliar</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  welcome: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  name: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,102,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  statusBannerBlocked: {
    backgroundColor: "rgba(255,77,77,0.1)",
    borderColor: "rgba(255,77,77,0.35)",
  },
  statusBannerTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  statusBannerText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  earningsCard: {
    borderRadius: 26,
    padding: 22,
    shadowColor: "#FF6600",
    shadowOpacity: 0.35,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  earningsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.semiBold,
  },
  earningsValue: {
    fontSize: 42,
    fontFamily: fonts.extraBold,
    color: "#fff",
    letterSpacing: -1,
    marginTop: 2,
  },
  earningsStatsRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  earningsStatValue: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  earningsStatLabel: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  newBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 20,
  },
  requestCard: {
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  activeCard: {
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  mapLinkText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  requestTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  requestMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  scheduledChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,102,0,0.12)",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 12,
  },
  scheduledChipText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  requestDesc: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 18,
    marginBottom: 14,
  },
  requestPrice: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  statusChip: {
    backgroundColor: "rgba(255,102,0,0.16)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  chatIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 10,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.destructive,
    borderWidth: 1.5,
    borderColor: "#1c1c3a",
  },
  chatBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: theme.colors.destructiveForeground,
  },
  proposeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  proposeButtonText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  requestActions: {
    flexDirection: "row",
    gap: 10,
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.55)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  rateCta: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
    marginTop: 2,
  },
}));
