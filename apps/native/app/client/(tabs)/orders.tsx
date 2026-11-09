import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import {
  initialsOf,
  isOrderActive,
  isOrderPaid,
  moneyFromCents,
  orderStatusLabel,
  shortTime,
} from "@/lib/format";
import { useMyProviderProfile, useOrders } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

// Título legível do pedido a partir dos campos disponíveis.
function orderTitle(order: Order): string {
  if (order.isOpenRequest && order.description) return order.description;
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

// "Pedi" = chamadas em que sou o cliente. "Atendi" = chamadas em que estou
// atendendo (helper ou prestador). O segundo lado só existe com perfil de quem atende.
type Side = "asked" | "attended";
type Tab = "andamento" | "concluidos";

const goTo = (pathname: string, id: string) => router.push({ pathname, params: { id } } as never);

export default function Orders() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: profile } = useMyProviderProfile();
  const hasWorkProfile = !!profile;
  const [side, setSide] = useState<Side>("asked");
  const [tab, setTab] = useState<Tab>("andamento");

  const asked = useOrders("client", { poll: true });
  const attended = useOrders("provider", { poll: hasWorkProfile, enabled: hasWorkProfile });
  const attending = side === "attended" && hasWorkProfile;
  const { data: orders = [], isLoading } = attending ? attended : asked;

  const activeOrders = orders.filter((o) => isOrderActive(o.status));
  const completedOrders = orders.filter((o) => !isOrderActive(o.status));

  const emptyActive = attending
    ? "Você não está atendendo nenhuma chamada."
    : "Você não tem chamadas em andamento.";
  const emptyCompleted = attending
    ? "Nenhuma chamada atendida ainda."
    : "Nenhum pedido no histórico ainda.";

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.heading}>Minhas chamadas</Text>
        {hasWorkProfile && (
          <View style={styles.sideRow}>
            {(
              [
                { key: "asked", label: "Pedi", icon: "hand-left-outline" },
                { key: "attended", label: "Atendi", icon: "briefcase-outline" },
              ] as { key: Side; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[]
            ).map((s) => {
              const active = side === s.key;
              return (
                <Pressable key={s.key} onPress={() => setSide(s.key)}>
                  <View style={[styles.sideChip, active && styles.sideChipActive]}>
                    <Ionicons
                      name={s.icon}
                      size={14}
                      color={active ? "#fff" : theme.colors.mutedForeground}
                    />
                    <Text style={[styles.sideChipText, active && styles.sideChipTextActive]}>
                      {s.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
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
              <Text style={styles.emptyText}>{emptyActive}</Text>
            )}
            {activeOrders.map((order) =>
              attending ? (
                <AttendedActiveCard key={order.id} order={order} />
              ) : (
                <AskedActiveCard key={order.id} order={order} />
              ),
            )}
          </>
        )}

        {tab === "concluidos" && (
          <>
            {!isLoading && completedOrders.length === 0 && (
              <Text style={styles.emptyText}>{emptyCompleted}</Text>
            )}
            {completedOrders.map((order) => {
              const name = attending
                ? order.client.name
                : (order.provider?.name ?? "Prestador");
              const price = attending ? order.priceCents : order.totalCents;
              const ratingPath = attending ? "/client/attend-rating/[id]" : "/client/rating/[id]";
              return (
                <Pressable
                  key={order.id}
                  style={({ pressed }) => [styles.completedRow, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => goTo(ratingPath, order.id)}
                >
                  <Avatar initials={initialsOf(name)} color="#3a3a70" size={46} radius={13} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completedTitle}>{orderTitle(order)}</Text>
                    <Text style={styles.completedMeta}>
                      {name} · {orderStatusLabel(order.status)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.completedPrice}>{moneyFromCents(price)}</Text>
                    {order.status === "COMPLETED" && <Text style={styles.rateCta}>★ avaliar</Text>}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

type ActionSpec = { label: string; run: () => void };

type CardProps = {
  order: Order;
  enRoute: boolean;
  statusColor: string;
  counterpartName: string;
  counterpartAvatar: string | null | undefined;
  counterpartMeta: string;
  price: number;
  primaryAction: ActionSpec;
  secondaryAction?: ActionSpec;
  onPress: () => void;
};

// Card de chamada ativa. Quem decide rótulos/destinos é o lado (pedi × atendi).
function ActiveCard({
  order,
  enRoute,
  statusColor,
  counterpartName,
  counterpartAvatar,
  counterpartMeta,
  price,
  primaryAction,
  secondaryAction,
  onPress,
}: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orderCard,
        enRoute ? styles.orderCardActive : styles.orderCardMuted,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.orderTop}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {orderStatusLabel(order.status)}
          </Text>
        </View>
        <Text style={styles.orderWhen}>{shortTime(order.createdAt)}</Text>
      </View>
      <View style={styles.orderBody}>
        <Avatar
          initials={initialsOf(counterpartName)}
          imageUri={counterpartAvatar}
          color="#FF6600"
          size={52}
          radius={15}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.orderTitle}>{orderTitle(order)}</Text>
          <Text style={styles.orderMeta}>{counterpartMeta}</Text>
        </View>
        <Text style={styles.orderPrice}>{moneyFromCents(price)}</Text>
      </View>
      <View style={styles.orderActions}>
        <Pressable
          style={styles.primaryAction}
          onPress={(e) => {
            e.stopPropagation?.();
            primaryAction.run();
          }}
        >
          <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
        </Pressable>
        {secondaryAction && (
          <Pressable
            style={styles.secondaryAction}
            onPress={(e) => {
              e.stopPropagation?.();
              secondaryAction.run();
            }}
          >
            <Text style={styles.secondaryActionText}>{secondaryAction.label}</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.iconAction}
          onPress={(e) => {
            e.stopPropagation?.();
            goTo("/client/chat/[id]", order.id);
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          {order.unreadMessages > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>
                {order.unreadMessages > 9 ? "9+" : order.unreadMessages}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

// Lado "Pedi": sou o cliente da chamada.
function AskedActiveCard({ order }: { order: Order }) {
  const { theme } = useUnistyles();
  const enRoute = order.status === "EN_ROUTE" || order.status === "IN_PROGRESS";
  const waiting = order.status === "CREATED";
  const needsPay = order.status === "ACCEPTED" && !isOrderPaid(order.payment);
  const isHelpAsk = order.isOpenRequest;
  const canTrackOnMap =
    !!order.provider &&
    (order.status === "EN_ROUTE" ||
      order.status === "IN_PROGRESS" ||
      (order.status === "ACCEPTED" && !needsPay));
  const goDetails = () => goTo("/client/order/[id]", order.id);
  const goPayment = () => goTo("/client/payment/[id]", order.id);

  const primaryAction: ActionSpec = (() => {
    if (waiting) {
      return { label: "Aguardando aceite", run: () => goTo("/client/waiting/[id]", order.id) };
    }
    if (needsPay) return { label: "Efetuar pagamento", run: goPayment };
    if (!isHelpAsk && canTrackOnMap) {
      return {
        label: order.status === "IN_PROGRESS" ? "Ver no mapa" : "Acompanhar caminho",
        run: () => goTo("/client/tracking/[id]", order.id),
      };
    }
    return { label: "Ver detalhes", run: goDetails };
  })();

  return (
    <ActiveCard
      order={order}
      enRoute={enRoute}
      statusColor={enRoute ? theme.colors.primary : theme.colors.info}
      counterpartName={order.provider?.name ?? "?"}
      counterpartAvatar={order.provider?.avatarUrl}
      counterpartMeta={`${order.provider?.name ?? (waiting ? "Aguardando alguém" : "Quem ajuda")}${
        order.provider?.headline ? ` · ${order.provider.headline}` : ""
      }`}
      price={order.totalCents}
      primaryAction={primaryAction}
      secondaryAction={
        (isHelpAsk ? needsPay : canTrackOnMap) ? { label: "Detalhes", run: goDetails } : undefined
      }
      onPress={needsPay ? goPayment : goDetails}
    />
  );
}

// Lado "Atendi": estou atendendo essa chamada (helper ou prestador). O valor
// mostrado é o que eu recebo; aceitar/terminar continuam no mapa da Início.
function AttendedActiveCard({ order }: { order: Order }) {
  const { theme } = useUnistyles();
  const enRoute = order.status === "EN_ROUTE" || order.status === "IN_PROGRESS";
  const goDetails = () => goTo("/client/order/[id]", order.id);
  const goAttend = () => goTo("/client/attend/[id]", order.id);

  const primaryAction: ActionSpec = (() => {
    if (order.status === "ACCEPTED") return { label: "Ir para o mapa", run: goAttend };
    if (order.status === "EN_ROUTE") return { label: "Continuar no mapa", run: goAttend };
    if (order.status === "AWAITING_CONFIRMATION") {
      return { label: "Aguardando confirmação", run: goDetails };
    }
    return { label: "Ver detalhes", run: goDetails };
  })();
  const onMap = order.status === "ACCEPTED" || order.status === "EN_ROUTE";

  return (
    <ActiveCard
      order={order}
      enRoute={enRoute}
      statusColor={enRoute ? theme.colors.primary : theme.colors.info}
      counterpartName={order.client.name}
      counterpartAvatar={order.client.avatarUrl}
      counterpartMeta={`${order.client.name} · você recebe`}
      price={order.providerNetCents}
      primaryAction={primaryAction}
      secondaryAction={onMap ? { label: "Detalhes", run: goDetails } : undefined}
      onPress={goDetails}
    />
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
  sideRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },
  sideChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sideChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sideChipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  sideChipTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  segment: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
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
  secondaryAction: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryActionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  iconAction: {
    width: 48,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 13,
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
}));
