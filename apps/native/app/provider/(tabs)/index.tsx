import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order, OrderAction, OrderStatus } from "@/lib/api";
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

function orderTitle(order: Order): string {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

// Próxima ação do prestador para um pedido já aceito.
function nextAction(status: OrderStatus): { action: OrderAction; label: string } | null {
  switch (status) {
    case "ACCEPTED":
      return { action: "start_route", label: "Iniciar trajeto" };
    case "EN_ROUTE":
      return { action: "start_work", label: "Iniciar serviço" };
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
  const { data: orders = [], isLoading } = useOrders("provider");
  const transition = useTransitionOrder();
  const setAvailability = useSetAvailability();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;

  const newOrders = orders.filter((o) => o.status === "CREATED");
  const activeOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE" || o.status === "IN_PROGRESS",
  );
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const enRouteOrder = activeOrders.find(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE",
  );
  useShareLocationWhileEnRoute(enRouteOrder?.id);

  const act = (id: string, action: OrderAction) => transition.mutate({ id, action });

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
          <Pressable
            style={[styles.activeChip, !profile?.isAvailable && styles.activeChipOff]}
            disabled={setAvailability.isPending}
            onPress={() => setAvailability.mutate(!profile?.isAvailable)}
          >
            <View style={[styles.activeDot, !profile?.isAvailable && styles.activeDotOff]} />
            <Text style={[styles.activeText, !profile?.isAvailable && styles.activeTextOff]}>
              {profile?.isAvailable ? "Disponível" : "Offline"}
            </Text>
          </Pressable>
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
            <View style={styles.requestActions}>
              <Pressable
                style={styles.declineButton}
                onPress={() => act(order.id, "reject")}
                disabled={transition.isPending}
              >
                <Text style={styles.declineText}>Recusar</Text>
              </Pressable>
              <Pressable
                style={styles.acceptButton}
                onPress={() => act(order.id, "accept")}
                disabled={transition.isPending}
              >
                <Text style={styles.acceptText}>Aceitar pedido</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {activeOrders.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Em andamento</Text>
          </View>
        )}

        {activeOrders.map((order) => {
          const next = nextAction(order.status);
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
                </Pressable>
              </View>
              {next && (
                <Pressable
                  style={styles.advanceButton}
                  onPress={() => act(order.id, next.action)}
                  disabled={transition.isPending}
                >
                  <Text style={styles.acceptText}>{next.label}</Text>
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
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(49,208,127,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  activeChipOff: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  activeDotOff: {
    backgroundColor: theme.colors.mutedForeground,
  },
  activeText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  activeTextOff: {
    color: theme.colors.mutedForeground,
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
  requestActions: {
    flexDirection: "row",
    gap: 10,
  },
  declineButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 13,
  },
  declineText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 13,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  advanceButton: {
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 13,
  },
  acceptText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
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
