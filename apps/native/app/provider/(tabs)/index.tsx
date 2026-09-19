import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Avatar } from "@/components/ui/avatar";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ProviderMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";
import { fonts } from "@/constants/fonts";
import type { Order, OrderAction, OrderStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  initialsOf,
  moneyFromCents,
  orderStatusLabel,
  shortDateTime,
  shortTime,
} from "@/lib/format";
import {
  useMyJobPostings,
  useMyProviderProfile,
  useNotifications,
  useOrders,
  useSetAvailability,
  useTransitionOrder,
} from "@/lib/hooks";
import { useCurrentLocation, useShareLocationWhileEnRoute } from "@/lib/location";

function orderTitle(order: Order): string {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

function firstNameOf(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || "Prestador";
}

function addressLine(order: Order): string {
  const { street, number, neighborhood, city } = order.address;
  return `${street}${number ? `, ${number}` : ""}${neighborhood ? ` · ${neighborhood}` : ""} · ${city}`;
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
  const isCompany = profile?.isCompany === true;
  const { data: myJobs = [] } = useMyJobPostings(isCompany);
  const { data: orders = [], isLoading } = useOrders("provider", { poll: true });
  const transition = useTransitionOrder();
  const setAvailability = useSetAvailability();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;
  const [pendingOrder, setPendingOrder] = useState<{ id: string; action: OrderAction } | null>(null);
  const myLocation = useCurrentLocation();

  const newOrders = orders.filter((o) => o.status === "CREATED");
  const activeOrders = orders.filter(
    (o) =>
      o.status === "ACCEPTED" ||
      o.status === "EN_ROUTE" ||
      o.status === "IN_PROGRESS" ||
      o.status === "AWAITING_CONFIRMATION",
  );
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const enRouteOrder = activeOrders.find(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE",
  );
  useShareLocationWhileEnRoute(enRouteOrder?.id);

  const prevStatusRef = useRef<Map<string, OrderStatus>>(new Map());
  useEffect(() => {
    for (const order of orders) {
      const prev = prevStatusRef.current.get(order.id);
      if (prev === "AWAITING_CONFIRMATION" && order.status === "COMPLETED") {
        router.push({ pathname: "/provider/rating/[id]", params: { id: order.id } });
      }
    }
    prevStatusRef.current = new Map(orders.map((o) => [o.id, o.status]));
  }, [orders]);

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

  const isAvailable = Boolean(profile?.isAvailable);
  const firstName = firstNameOf(user?.fullName);

  const mapCenter = useMemo<[number, number] | undefined>(() => {
    if (myLocation) return [myLocation.lng, myLocation.lat];
    if (profile?.baseLng != null && profile?.baseLat != null) {
      return [profile.baseLng, profile.baseLat];
    }
    return undefined;
  }, [myLocation, profile?.baseLat, profile?.baseLng]);

  const markers = useMemo(() => {
    const selfLngLat = mapCenter;
    const jobPins = [...newOrders, ...activeOrders]
      .filter((o) => o.address.lat != null && o.address.lng != null)
      .slice(0, 8)
      .map((order, index) => ({
        id: order.id,
        lngLat: [order.address.lng, order.address.lat] as [number, number],
        render: () => (
          <ProviderMarker
            initials={initialsOf(order.client.name)}
            color={order.status === "CREATED" ? "#FF6600" : "#3a3a70"}
            highlighted={index === 0 && order.status === "CREATED"}
          />
        ),
        onPress: () => router.push({ pathname: "/provider/order/[id]", params: { id: order.id } }),
      }));

    return [
      ...jobPins,
      ...(selfLngLat
        ? [
            {
              id: "self",
              lngLat: selfLngLat,
              render: () => <SelfMarker />,
            },
          ]
        : []),
    ];
  }, [activeOrders, mapCenter, newOrders]);

  const availabilityLabel = setAvailability.isPending
    ? "Atualizando..."
    : isAvailable
      ? "Você está disponível"
      : "Ficar disponível agora";

  return (
    <Screen>
      <RealMap markers={markers} center={mapCenter} />

      <View
        style={[styles.overlay, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <View style={styles.topBar}>
          <GlassSurface
            style={[styles.greetingPill, isAvailable ? styles.greetingPillOn : styles.greetingPillOff]}
          >
            <Avatar
              initials={initialsOf(user?.fullName ?? "?")}
              imageUri={user?.avatarUrl}
              size={34}
              radius={11}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingLabel}>OLÁ, {firstName.toUpperCase()}</Text>
              <Text
                style={[styles.greetingValue, !isAvailable && styles.greetingValueOff]}
                numberOfLines={1}
              >
                {isAvailable ? "Disponível agora" : "Você está offline"}
              </Text>
            </View>
            <View style={[styles.liveDot, !isAvailable && styles.liveDotOff]} />
          </GlassSurface>
          <Pressable
            onPress={() =>
              router.push((isCompany ? "/provider/vaga" : "/jobs") as never)
            }
          >
            <GlassSurface style={styles.iconButton}>
              <Ionicons name="briefcase-outline" size={22} color="#fff" />
            </GlassSurface>
          </Pressable>
          <Pressable onPress={() => router.push("/provider/notifications" as never)}>
            <GlassSurface style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {hasUnread && <View style={styles.bellDot} />}
            </GlassSurface>
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

        <Pressable
          style={({ pressed }) => [
            styles.availabilityBar,
            !isAvailable && styles.availabilityBarOff,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => setAvailability.mutate(!isAvailable)}
          disabled={setAvailability.isPending}
        >
          <Ionicons
            name={isAvailable ? "radio-button-on" : "moon"}
            size={22}
            color={isAvailable ? "#fff" : theme.colors.mutedForeground}
          />
          <Text style={[styles.availabilityText, !isAvailable && styles.availabilityTextOff]}>
            {availabilityLabel}
          </Text>
        </Pressable>

        {isCompany && (
          <Pressable
            style={({ pressed }) => [styles.vagaCard, { opacity: pressed ? 0.92 : 1 }]}
            onPress={() =>
              router.push(myJobs.length > 0 ? "/provider/vaga" : "/provider/vaga/ai/chat")
            }
          >
            <View style={styles.vagaIcon}>
              <Ionicons name="briefcase" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vagaTitle}>Publicar vaga</Text>
              <Text style={styles.vagaSubtitle} numberOfLines={1}>
                {myJobs.length > 0
                  ? `${myJobs.length} vaga${myJobs.length === 1 ? "" : "s"} da empresa`
                  : "Contrate pela sua empresa com a JudIA"}
              </Text>
            </View>
            <Pressable
              style={styles.vagaButton}
              onPress={() => router.push("/provider/vaga/ai/chat")}
            >
              <Text style={styles.vagaButtonText}>Nova</Text>
            </Pressable>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Ativos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{newOrders.length}</Text>
            <Text style={styles.statLabel}>Novos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{completedOrders.length}</Text>
            <Text style={styles.statLabel}>Concluídos</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Novos pedidos</Text>
          {newOrders.length > 0 ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{newOrders.length} novos</Text>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/provider/map" as never)}>
              <Text style={styles.sectionLink}>Ver mapa</Text>
            </Pressable>
          )}
        </View>

        {isLoading && (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
        )}

        {!isLoading && newOrders.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="flash-outline" size={18} color={theme.colors.mutedForeground} />
            <Text style={styles.emptyText}>Nenhum pedido novo no momento.</Text>
          </View>
        )}

        {newOrders.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
          >
            {newOrders.map((order) => {
              const paymentPaid = order.payment?.status === "PAID";
              const accepting =
                transition.isPending && pendingOrder?.id === order.id && pendingOrder.action === "accept";
              const rejecting =
                transition.isPending && pendingOrder?.id === order.id && pendingOrder.action === "reject";
              return (
                <Pressable
                  key={order.id}
                  style={({ pressed }) => [styles.jobCard, { opacity: pressed ? 0.92 : 1 }]}
                  onPress={() =>
                    router.push({ pathname: "/provider/order/[id]", params: { id: order.id } })
                  }
                >
                  <View style={styles.jobHeader}>
                    <Avatar initials={initialsOf(order.client.name)} color="#3a3a70" size={46} radius={14} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle} numberOfLines={1}>
                        {orderTitle(order)}
                      </Text>
                      <Text style={styles.jobMeta} numberOfLines={1}>
                        {order.client.name} · {shortTime(order.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.jobPrice}>{moneyFromCents(order.totalCents)}</Text>
                  </View>

                  <View style={styles.jobAddress}>
                    <Ionicons name="location" size={13} color={theme.colors.mutedForeground} />
                    <Text style={styles.jobAddressText} numberOfLines={1}>
                      {addressLine(order)}
                    </Text>
                  </View>

                  {order.scheduledAt && (
                    <View style={styles.scheduledChip}>
                      <Ionicons name="calendar" size={13} color={theme.colors.primary} />
                      <Text style={styles.scheduledChipText}>
                        Agendado para {shortDateTime(order.scheduledAt)}
                      </Text>
                    </View>
                  )}

                  {order.description ? (
                    <Text style={styles.jobDesc} numberOfLines={2}>
                      {order.description}
                    </Text>
                  ) : null}

                  {profile?.allowsNegotiation && (
                    <Pressable
                      style={styles.proposeButton}
                      onPress={() =>
                        router.push({ pathname: "/provider/propose/[id]", params: { id: order.id } })
                      }
                    >
                      <Ionicons name="pricetag-outline" size={14} color="#FF9a52" />
                      <Text style={styles.proposeButtonText}>Propor outro valor</Text>
                    </Pressable>
                  )}

                  <View style={styles.jobActions}>
                    <SpinButton
                      controlled
                      isActive={rejecting}
                      disabled={transition.isPending}
                      idleText="Recusar"
                      activeText="Recusando..."
                      onPress={() => act(order.id, "reject")}
                      colors={{
                        idle: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                        active: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                      }}
                      buttonStyle={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, fontSize: 13.5 }}
                      spinnerConfig={{
                        color: theme.colors.mutedForeground,
                        containerBackground: "rgba(255,255,255,0.06)",
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <SpinButton
                        controlled
                        isActive={accepting}
                        disabled={transition.isPending || !paymentPaid}
                        idleText={paymentPaid ? "Aceitar" : "Aguardando pagamento"}
                        activeText="Aceitando..."
                        onPress={() => act(order.id, "accept")}
                        colors={{
                          idle: { background: theme.colors.primary, text: "#fff" },
                          active: { background: theme.colors.primary, text: "#fff" },
                        }}
                        buttonStyle={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, fontSize: 14 }}
                        spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {activeOrders.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Em andamento</Text>
          </View>
        )}

        <ScrollView
          horizontal={activeOrders.length > 1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={activeOrders.length > 1 ? styles.cardsRow : undefined}
          scrollEnabled={activeOrders.length > 1}
        >
          {activeOrders.map((order) => {
            const next = nextAction(order);
            const updating =
              transition.isPending && pendingOrder?.id === order.id && pendingOrder.action === next?.action;
            return (
              <Pressable
                key={order.id}
                style={({ pressed }) => [
                  styles.activeCard,
                  activeOrders.length > 1 && styles.activeCardWide,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={() =>
                  router.push({ pathname: "/provider/order/[id]", params: { id: order.id } })
                }
              >
                <View style={styles.jobHeader}>
                  <Avatar initials={initialsOf(order.client.name)} color="#3a3a70" size={46} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle} numberOfLines={1}>
                      {orderTitle(order)}
                    </Text>
                    <Text style={styles.jobMeta}>{order.client.name}</Text>
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
                    isActive={updating}
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
              </Pressable>
            );
          })}
        </ScrollView>

        {completedOrders.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Concluídos</Text>
            </View>
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
                  <Text style={styles.jobTitle}>{orderTitle(order)}</Text>
                  <Text style={styles.jobMeta}>{order.client.name}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.jobPrice}>{moneyFromCents(order.totalCents)}</Text>
                  <Text style={styles.rateCta}>★ avaliar</Text>
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 13,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  greetingPill: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  greetingPillOn: {
    borderColor: "rgba(49,208,127,0.45)",
  },
  greetingPillOff: {
    borderColor: "rgba(255,255,255,0.12)",
  },
  greetingValueOff: {
    color: theme.colors.mutedForeground,
  },
  greetingLabel: {
    fontSize: 10.5,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.bold,
    lineHeight: 12,
  },
  greetingValue: {
    fontSize: 14,
    color: "#fff",
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
  },
  liveDotOff: {
    backgroundColor: theme.colors.mutedForeground,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: "#14142e",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(20,20,46,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 16,
    padding: 14,
  },
  statusBannerBlocked: {
    backgroundColor: "rgba(20,20,46,0.92)",
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
  availabilityBar: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  availabilityBarOff: {
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  availabilityText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  availabilityTextOff: {
    color: theme.colors.mutedForeground,
  },
  vagaCard: {
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.45)",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vagaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  vagaTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  vagaSubtitle: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  vagaButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  vagaButtonText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    maxHeight: "48%",
  },
  sheetContent: {
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  statLabel: {
    fontSize: 10.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
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
  emptyCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    flex: 1,
  },
  cardsRow: {
    gap: 12,
    paddingHorizontal: 16,
  },
  jobCard: {
    width: 300,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: theme.borderRadius.xxl,
    padding: 15,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  jobTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  jobMeta: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  jobPrice: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  jobAddress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  jobAddressText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
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
    marginTop: 10,
  },
  scheduledChipText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  jobDesc: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 18,
    marginTop: 10,
  },
  proposeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  proposeButtonText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  jobActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  activeCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xxl,
    padding: 15,
    gap: 10,
  },
  activeCardWide: {
    width: 300,
    marginHorizontal: 0,
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
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  rateCta: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
    marginTop: 2,
  },
}));
