import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useNavigation } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AttendRadar } from "@/components/attend-radar";
import { AttendTurnOn } from "@/components/attend-turn-on";
import { HelpAskButton } from "@/components/help-ask-button";
import { HelpSheet } from "@/components/help-sheet";
import { MapStatusCard } from "@/components/map-status-card";
import { Avatar } from "@/components/ui/avatar";
import { HelpMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap, type RealMapHandle } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";
import { fonts } from "@/constants/fonts";
import type { Order, OrderAction, OrderStatus } from "@/lib/api";
import { useAttendButtonVisibility } from "@/lib/attend-button";
import { useAuth } from "@/lib/auth-context";
import {
  formatAddressLine,
  initialsOf,
  isOrderActive,
  moneyFromCents,
} from "@/lib/format";
import { useHelperMode } from "@/lib/helper-mode";
import {
  useAddresses,
  useNotifications,
  useOrders,
  useTransitionOrder,
} from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";
import {
  readForegroundPosition,
  useCurrentLocation,
  useShareIdleLocation,
  useShareLocationWhileEnRoute,
} from "@/lib/location";
import { distanceKm } from "@/lib/nearby";
import { useQueryClient } from "@tanstack/react-query";

/** Mesmo TTL do backend (waiting / offerExpiresAt em open request). */
const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;

import { clientFloatingTabBarStyle } from "./_layout";

const ACTIVE: OrderStatus[] = [
  "ACCEPTED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "AWAITING_CONFIRMATION",
];

function helpTitle(order: Order): string {
  return order.description?.trim() || order.category?.name || "Ajuda";
}

function needsPayment(order: Order): boolean {
  return (
    order.status === "ACCEPTED" &&
    order.payment?.status !== "PAID" &&
    order.payment?.method !== "CASH"
  );
}

/** Destino + CTA da ajuda que o usuário pediu (papel de solicitante). */
function myHelpHomeAction(order: Order): {
  meta: string;
  ctaLabel: string;
  href: string;
} {
  const unpaid = needsPayment(order);
  const helperName = order.provider?.name?.split(" ")[0];

  if (order.status === "CREATED") {
    return {
      meta: order.provider
        ? "Aguardando aceite"
        : "Aguardando alguém perto",
      ctaLabel: "Acompanhar",
      href: `/client/waiting/${order.id}`,
    };
  }
  if (unpaid) {
    return {
      meta: "Pagamento pendente",
      ctaLabel: "Efetuar pagamento",
      href: `/client/payment/${order.id}`,
    };
  }
  if (order.status === "AWAITING_CONFIRMATION") {
    return {
      meta: "Confirme a conclusão",
      ctaLabel: "Confirmar conclusão",
      href: `/client/order/${order.id}`,
    };
  }
  if (
    order.status === "EN_ROUTE" ||
    order.status === "IN_PROGRESS" ||
    (order.status === "ACCEPTED" && !!order.provider)
  ) {
    const tracking =
      order.status === "IN_PROGRESS"
        ? "Ajuda em andamento"
        : order.status === "EN_ROUTE"
          ? helperName
            ? `${helperName} a caminho`
            : "Alguém a caminho"
          : helperName
            ? `Com ${helperName}`
            : "Combinado";
    const canTrack =
      !!order.provider &&
      (order.status === "EN_ROUTE" ||
        order.status === "IN_PROGRESS" ||
        order.status === "ACCEPTED");
    return {
      meta: tracking,
      ctaLabel:
        order.status === "IN_PROGRESS"
          ? "Ver no mapa"
          : canTrack
            ? "Acompanhar caminho"
            : "Ver detalhes",
      href: canTrack
        ? `/client/tracking/${order.id}`
        : `/client/order/${order.id}`,
    };
  }
  return {
    meta: moneyFromCents(order.totalCents ?? order.priceCents),
    ctaLabel: "Ver detalhes",
    href: `/client/order/${order.id}`,
  };
}

function helperNextAction(
  order: Order,
): { action: OrderAction; label: string; disabled?: boolean } | null {
  const paid =
    order.payment?.status === "PAID" || order.payment?.method === "CASH";
  switch (order.status) {
    case "ACCEPTED":
      // Ajuda aberta: pagamento libera o trajeto (endereço já veio no pedido).
      if (!paid)
        return {
          action: "start_route",
          label: "Aguardando pagamento",
          disabled: true,
        };
      return { action: "start_route", label: "Iniciar caminho" };
    case "EN_ROUTE":
      return order.tracking.arrived
        ? { action: "start_work", label: "Cheguei, começar" }
        : { action: "start_work", label: "Aguardando chegada", disabled: true };
    case "IN_PROGRESS":
      return { action: "complete", label: "Terminei" };
    case "AWAITING_CONFIRMATION":
      return {
        action: "complete",
        label: "Aguardando confirmação",
        disabled: true,
      };
    default:
      return null;
  }
}

function helperHomeMeta(order: Order): string {
  const price = moneyFromCents(order.priceCents);
  const paid =
    order.payment?.status === "PAID" || order.payment?.method === "CASH";
  if (order.status === "ACCEPTED" && paid) {
    return `Pode iniciar o trajeto · ${price}`;
  }
  if (order.status === "ACCEPTED" && !paid) {
    return `Aguardando pagamento · ${price}`;
  }
  return price;
}

export default function ClientHome() {
  const navigation = useNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const bottomWidth = windowWidth - 40;
  const { user } = useAuth();
  const helper = useHelperMode();
  const attendButton = useAttendButtonVisibility();
  const myLocation = useCurrentLocation();
  const queryClient = useQueryClient();
  const { data: addresses = [] } = useAddresses();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;
  const canPollHelps = user?.role === "BOTH";
  const { data: clientOrders = [] } = useOrders("client", { poll: true });
  const { data: helperOrders = [] } = useOrders("provider", {
    poll: canPollHelps,
    enabled: canPollHelps,
  });
  const transition = useTransitionOrder();

  // Ao ligar o modo, força lista alinhada à posição atual (evita “N no mapa” fantasma).
  useEffect(() => {
    if (!helper.isOn || !canPollHelps) return;
    void queryClient.invalidateQueries({ queryKey: ["orders", "provider"] });
  }, [helper.isOn, canPollHelps, queryClient]);

  const [selectedHelpId, setSelectedHelpId] = useState<string | null>(null);
  const [liveOrigin, setLiveOrigin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radarReady, setRadarReady] = useState(false);
  const mapRef = useRef<RealMapHandle>(null);
  const helpSheetRef = useRef<BottomSheetMethods>(null);
  const wasAttendingRef = useRef(false);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const origin =
    liveOrigin ??
    myLocation ??
    (defaultAddress
      ? { lat: defaultAddress.lat, lng: defaultAddress.lng }
      : null);

  const centerOnMe = async () => {
    try {
      const fresh = await readForegroundPosition();
      const point = fresh ?? origin;
      if (!point) return;
      setLiveOrigin(point);
      await mapRef.current?.recenter([point.lng, point.lat]);
    } catch {
      if (origin) await mapRef.current?.recenter([origin.lng, origin.lat]);
    }
  };

  useShareIdleLocation(helper.isOn);

  // Ao ligar o modo atender: centraliza primeiro e só então libera o radar.
  useEffect(() => {
    const attendingNow = helper.isOn || helper.arming;
    if (!attendingNow) {
      wasAttendingRef.current = false;
      setRadarReady(false);
      return;
    }
    if (wasAttendingRef.current) return;
    wasAttendingRef.current = true;
    setRadarReady(false);
    let cancelled = false;
    void centerOnMe().finally(() => {
      if (!cancelled) setRadarReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à transição de ligar o modo
  }, [helper.isOn, helper.arming]);

  const activeOrder = helperOrders.find((order) =>
    ACTIVE.includes(order.status),
  );
  // Pedido que o usuário fez (solicitante) — aparece no mapa quando não está
  // atendendo outra ajuda.
  const myActiveOrder = clientOrders.find((order) => isOrderActive(order.status));
  const myHelp = myActiveOrder ? myHelpHomeAction(myActiveOrder) : null;
  useShareLocationWhileEnRoute(
    activeOrder && activeOrder.status !== "AWAITING_CONFIRMATION"
      ? activeOrder.id
      : undefined,
  );

  const prevStatusRef = useRef<Map<string, OrderStatus>>(new Map());
  useEffect(() => {
    for (const order of helperOrders) {
      const prev = prevStatusRef.current.get(order.id);
      if (prev === "AWAITING_CONFIRMATION" && order.status === "COMPLETED") {
        router.push({
          pathname: "/client/attend-rating/[id]",
          params: { id: order.id },
        });
      }
    }
    prevStatusRef.current = new Map(
      helperOrders.map((order) => [order.id, order.status]),
    );
  }, [helperOrders]);

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      navigation.setOptions({ tabBarStyle: clientFloatingTabBarStyle });
    };
  }, [navigation]);

  const locationCity = defaultAddress?.city ?? "Sua região";
  const locationStreet = defaultAddress
    ? formatAddressLine(defaultAddress)
    : myLocation
      ? "Sua localização"
      : "Definir endereço";

  const serviceRadiusKm = helper.profile?.serviceRadiusKm ?? 15;

  const openHelps = useMemo(() => {
    if (!helper.isOn) return [];
    const now = Date.now();
    return helperOrders.filter((order) => {
      if (order.status !== "CREATED" || !order.isOpenRequest || order.provider) {
        return false;
      }
      const age = now - new Date(order.createdAt).getTime();
      if (!Number.isFinite(age) || age > OPEN_REQUEST_TTL_MS) return false;
      // Conta só o que está perto da posição atual do mapa (mesmo critério do raio).
      if (origin) {
        const d = distanceKm(origin, {
          lat: order.address.lat,
          lng: order.address.lng,
        });
        if (d > serviceRadiusKm) return false;
      }
      return true;
    });
  }, [helper.isOn, helperOrders, origin, serviceRadiusKm]);

  const helpBounds = useMemo((): [number, number, number, number] | undefined => {
    if (!helper.isOn || !origin || openHelps.length === 0) return undefined;
    let west = origin.lng;
    let east = origin.lng;
    let south = origin.lat;
    let north = origin.lat;
    for (const order of openHelps) {
      west = Math.min(west, order.address.lng);
      east = Math.max(east, order.address.lng);
      south = Math.min(south, order.address.lat);
      north = Math.max(north, order.address.lat);
    }
    // Evita bounds degenerados quando tudo está no mesmo ponto.
    const pad = 0.002;
    if (east - west < pad) {
      west -= pad / 2;
      east += pad / 2;
    }
    if (north - south < pad) {
      south -= pad / 2;
      north += pad / 2;
    }
    return [west, south, east, north];
  }, [helper.isOn, origin, openHelps]);

  const selectedHelp =
    openHelps.find((order) => order.id === selectedHelpId) ?? null;
  const selectedDistance =
    selectedHelp && origin
      ? distanceKm(origin, {
          lat: selectedHelp.address.lat,
          lng: selectedHelp.address.lng,
        })
      : null;
  const selectedMinutes = selectedHelp
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(selectedHelp.createdAt).getTime()) / 60000,
        ),
      )
    : null;

  const openHelp = (order: Order) => {
    setSelectedHelpId(order.id);
    helpSheetRef.current?.snapToIndex(0);
  };

  const markers = [
    ...openHelps.map((order) => ({
      id: order.id,
      lngLat: [order.address.lng, order.address.lat] as [number, number],
      render: () => <HelpMarker highlighted={order.id === selectedHelpId} />,
      onPress: () => openHelp(order),
    })),
    ...(origin
      ? [
          {
            id: "self",
            lngLat: [origin.lng, origin.lat] as [number, number],
            render: () => <SelfMarker color={theme.colors.primary} />,
          },
        ]
      : []),
  ];

  const acceptHelp = () => {
    if (!selectedHelp) return;
    transition.mutate(
      { id: selectedHelp.id, action: "accept" },
      {
        onSuccess: (order) => {
          setSelectedHelpId(null);
          helpSheetRef.current?.close();
          router.push({
            pathname: "/client/attend/[id]",
            params: { id: order.id },
          });
        },
        onError: (err) =>
          toast.error(errorMessage(err, "Não foi possível atender agora.")),
      },
    );
  };

  const runActive = () => {
    if (!activeOrder) return;
    const next = helperNextAction(activeOrder);
    if (!next) return;
    if (next.disabled) {
      if (
        activeOrder.status === "ACCEPTED" ||
        activeOrder.status === "EN_ROUTE"
      ) {
        router.push({
          pathname: "/client/attend/[id]",
          params: { id: activeOrder.id },
        });
      }
      return;
    }
    transition.mutate(
      { id: activeOrder.id, action: next.action },
      {
        onSuccess: (order) => {
          if (next.action === "start_route") {
            router.push({
              pathname: "/client/attend/[id]",
              params: { id: order.id },
            });
          }
        },
        onError: (err) =>
          toast.error(errorMessage(err, "Não foi possível continuar.")),
      },
    );
  };

  const next = activeOrder ? helperNextAction(activeOrder) : null;
  const attending = helper.isOn || helper.arming || activeOrder != null;
  const showAttendEntry = attendButton.ready && !attendButton.hidden;
  // Ajuda que eu pedi tem prioridade sobre “ligar modo” / radar vazio.
  const showMyHelpCard = !activeOrder && myActiveOrder != null && myHelp != null;
  const showTurnOnCard =
    showAttendEntry &&
    !helper.isOn &&
    !helper.arming &&
    !activeOrder &&
    !showMyHelpCard;
  const showSearchingCard =
    (helper.isOn || helper.arming) && !activeOrder && !showMyHelpCard;

  return (
    <Screen>
      <RealMap
        ref={mapRef}
        markers={markers}
        center={origin ? [origin.lng, origin.lat] : undefined}
        bounds={helpBounds}
        cameraKey={helpBounds ? `helps-${openHelps.length}` : "me"}
        variant="dark"
        zoom={14}
      />
      {(helper.isOn || helper.arming) && !activeOrder && radarReady && (
        <AttendRadar />
      )}

      <View
        style={[styles.topArea, { paddingTop: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.push("/client/profile" as never)}>
            <Avatar
              initials={initialsOf(user?.fullName ?? "?")}
              imageUri={user?.avatarUrl}
              color={theme.colors.primary}
              size={44}
            />
          </Pressable>

          <Pressable
            style={styles.locationBlock}
            onPress={() => router.push("/client/addresses")}
          >
            <View style={styles.locationLabelRow}>
              <Ionicons
                name="location"
                size={12}
                color={theme.colors.primary}
              />
              <Text style={styles.locationLabel}>Sua localização</Text>
            </View>
            <Text style={styles.locationValue} numberOfLines={1}>
              {defaultAddress
                ? `${locationCity}, ${locationStreet}`
                : locationStreet}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/client/notifications" as never)}
          >
            <View style={styles.bellButton}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.colors.foreground}
              />
              {hasUnread && (
                <View
                  style={[
                    styles.bellDot,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.bottomArea,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.locateBtn}
          onPress={() => {
            void centerOnMe();
          }}
          accessibilityRole="button"
          accessibilityLabel="Centralizar minha localização"
        >
          <Ionicons name="locate" size={22} color={theme.colors.primary} />
        </Pressable>

        {activeOrder && next ? (
          <MapStatusCard
            kicker="Atendendo..."
            title={helpTitle(activeOrder)}
            meta={helperHomeMeta(activeOrder)}
            actionLabel={next.label}
            onAction={runActive}
            actionDisabled={next.disabled || transition.isPending}
            actionLoading={transition.isPending && !selectedHelp}
            onPress={() =>
              router.push({
                pathname: "/client/attend/[id]",
                params: { id: activeOrder.id },
              })
            }
            accentColor={theme.colors.primary}
          />
        ) : showMyHelpCard && myActiveOrder && myHelp ? (
          <MapStatusCard
            kicker="Sua ajuda"
            title={helpTitle(myActiveOrder)}
            meta={myHelp.meta}
            actionLabel={myHelp.ctaLabel}
            onAction={() => router.push(myHelp.href as never)}
            onPress={() => router.push(myHelp.href as never)}
            accentColor={theme.colors.primary}
          />
        ) : showSearchingCard ? (
          <MapStatusCard
            title={
              helper.arming
                ? "Obtendo sua localização"
                : openHelps.length === 0
                  ? "Procurando ajudas perto"
                  : openHelps.length === 1
                    ? "Ajuda disponível perto"
                    : "Ajudas disponíveis perto"
            }
            meta={
              helper.arming
                ? undefined
                : openHelps.length === 0
                  ? "Nenhuma por perto agora"
                  : openHelps.length === 1
                    ? "1 no mapa"
                    : `${openHelps.length} no mapa`
            }
            swipeLabel="Arraste para desligar"
            onSwipe={helper.toggle}
            swipeDisabled={helper.pending}
            accentColor={theme.colors.primary}
          />
        ) : showTurnOnCard ? (
          <AttendTurnOn
            needsSignup={helper.needsSignup}
            pending={helper.pending}
            onSwipe={helper.toggle}
          />
        ) : null}

        {!activeOrder && !showMyHelpCard && !attending ? (
          <HelpAskButton
            width={bottomWidth}
            onPress={() => router.push("/client/create-order" as never)}
          />
        ) : null}
      </View>

      <HelpSheet
        ref={helpSheetRef}
        order={selectedHelp}
        distanceKm={selectedDistance}
        minutesAgo={selectedMinutes}
        accepting={transition.isPending && selectedHelp != null}
        blockedLabel={activeOrder ? "Termine a ajuda atual" : null}
        onAccept={acceptHelp}
        onClose={() => setSelectedHelpId(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  locationBlock: { flex: 1, alignItems: "center" },
  locationLabelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationLabel: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  locationValue: {
    marginTop: 1,
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    maxWidth: "100%",
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
  },
  bottomArea: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    alignItems: "flex-end",
    gap: 12,
  },
  locateBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
}));
