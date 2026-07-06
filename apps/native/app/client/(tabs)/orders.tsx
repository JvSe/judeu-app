import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { initialsOf, isOrderActive, moneyFromCents, orderStatusLabel, shortTime } from "@/lib/format";
import { useOrders } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

// Título legível do pedido a partir dos campos disponíveis.
function orderTitle(order: Order): string {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

export default function Orders() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"andamento" | "concluidos">("andamento");
  const { data: orders = [], isLoading } = useOrders("client");

  const activeOrders = orders.filter((o) => isOrderActive(o.status));
  const completedOrders = orders.filter((o) => !isOrderActive(o.status));

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.heading}>Meus pedidos</Text>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentItem, tab === "andamento" && styles.segmentItemActive]}
            onPress={() => setTab("andamento")}
          >
            <Text style={[styles.segmentText, tab === "andamento" && styles.segmentTextActive]}>
              Em andamento
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, tab === "concluidos" && styles.segmentItemActive]}
            onPress={() => setTab("concluidos")}
          >
            <Text style={[styles.segmentText, tab === "concluidos" && styles.segmentTextActive]}>
              Concluídos
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />}

        {tab === "andamento" && (
          <>
            {!isLoading && activeOrders.length === 0 && (
              <Text style={styles.emptyText}>Você não tem pedidos em andamento.</Text>
            )}
            {activeOrders.map((order) => {
              const enRoute = order.status === "EN_ROUTE" || order.status === "IN_PROGRESS";
              return (
                <View
                  key={order.id}
                  style={[
                    styles.orderCard,
                    enRoute ? styles.orderCardActive : styles.orderCardMuted,
                  ]}
                >
                  <View style={styles.orderTop}>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: enRoute ? theme.colors.primary : theme.colors.info },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusLabel,
                          { color: enRoute ? theme.colors.primary : theme.colors.info },
                        ]}
                      >
                        {orderStatusLabel(order.status)}
                      </Text>
                    </View>
                    <Text style={styles.orderWhen}>{shortTime(order.createdAt)}</Text>
                  </View>
                  <View style={styles.orderBody}>
                    <Avatar
                      initials={initialsOf(order.provider?.name ?? "?")}
                      color="#FF6600"
                      size={52}
                      radius={15}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle}>{orderTitle(order)}</Text>
                      <Text style={styles.orderMeta}>
                        {order.provider?.name ?? "Prestador"}
                        {order.provider?.headline ? ` · ${order.provider.headline}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.orderPrice}>{moneyFromCents(order.totalCents)}</Text>
                  </View>
                  <View style={styles.orderActions}>
                    <Pressable
                      style={styles.primaryAction}
                      onPress={() =>
                        router.push({ pathname: "/client/order/[id]", params: { id: order.id } })
                      }
                    >
                      <Text style={styles.primaryActionText}>
                        {enRoute ? "Acompanhar" : "Ver detalhes"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() =>
                        router.push({ pathname: "/client/chat/[id]", params: { id: order.id } })
                      }
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {tab === "concluidos" && (
          <>
            {!isLoading && completedOrders.length === 0 && (
              <Text style={styles.emptyText}>Nenhum pedido no histórico ainda.</Text>
            )}
            {completedOrders.map((order) => (
              <Pressable
                key={order.id}
                style={({ pressed }) => [styles.completedRow, { opacity: pressed ? 0.85 : 1 }]}
                onPress={() =>
                  router.push({ pathname: "/client/rating/[id]", params: { id: order.id } })
                }
              >
                <Avatar
                  initials={initialsOf(order.provider?.name ?? "?")}
                  color="#3a3a70"
                  size={46}
                  radius={13}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedTitle}>{orderTitle(order)}</Text>
                  <Text style={styles.completedMeta}>
                    {order.provider?.name ?? "Prestador"} · {orderStatusLabel(order.status)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.completedPrice}>{moneyFromCents(order.totalCents)}</Text>
                  {order.status === "COMPLETED" && <Text style={styles.rateCta}>★ avaliar</Text>}
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 14,
    padding: 5,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  segmentTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 30,
  },
  orderCard: {
    borderRadius: 22,
    padding: 17,
    marginBottom: 16,
  },
  orderCardActive: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  orderCardMuted: {
    backgroundColor: "rgba(28,28,58,0.75)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12.5,
    fontFamily: fonts.extraBold,
  },
  orderWhen: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  orderBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  orderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  orderMeta: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  orderActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 13,
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  ghostAction: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  ghostActionText: {
    color: "#e8e8f5",
  },
  iconAction: {
    width: 48,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 10,
    marginBottom: 13,
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
  completedTitle: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  completedMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  completedPrice: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  rateCta: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
    marginTop: 2,
  },
  rateDone: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
    marginTop: 2,
  },
}));
