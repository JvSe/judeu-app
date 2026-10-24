import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useNavigation } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AttendFab } from "@/components/attend-fab";
import { AttendRadar } from "@/components/attend-radar";
import { HelpSheet } from "@/components/help-sheet";
import { Avatar } from "@/components/ui/avatar";
import { HelpMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";
import { fonts } from "@/constants/fonts";
import type { Order, OrderAction, OrderStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAddressLine, initialsOf, moneyFromCents } from "@/lib/format";
import { useAttendButtonVisibility } from "@/lib/attend-button";
import { useHelperMode } from "@/lib/helper-mode";
import { useAddresses, useNotifications, useOrders, useTransitionOrder } from "@/lib/hooks";
import { useCurrentLocation, useShareIdleLocation, useShareLocationWhileEnRoute } from "@/lib/location";
import { distanceKm } from "@/lib/nearby";

import { clientFloatingTabBarStyle } from "./_layout";

const ACTIVE: OrderStatus[] = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"];

function helpTitle(order: Order): string {
  return order.description?.trim() || order.category?.name || "Ajuda";
}

function helperNextAction(order: Order): { action: OrderAction; label: string; disabled?: boolean } | null {
  const paid = order.payment?.status === "PAID" || order.payment?.method === "CASH";
  switch (order.status) {
    case "ACCEPTED":
      if (order.isOpenRequest && !order.detailsReady) {
        return { action: "start_route", label: "Aguardando a pessoa", disabled: true };
      }
      if (!paid) return { action: "start_route", label: "Aguardando pagamento", disabled: true };
      return { action: "start_route", label: "Iniciar caminho" };
    case "EN_ROUTE":
      return order.tracking.arrived
        ? { action: "start_work", label: "Cheguei, começar" }
        : { action: "start_work", label: "Aguardando chegada", disabled: true };
    case "IN_PROGRESS":
      return { action: "complete", label: "Terminei" };
    case "AWAITING_CONFIRMATION":
      return { action: "complete", label: "Aguardando confirmação", disabled: true };
    default:
      return null;
  }
}

export default function ClientHome() {
  const navigation = useNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const helper = useHelperMode();
  const attendButton = useAttendButtonVisibility();
  const myLocation = useCurrentLocation();
  const { data: addresses = [] } = useAddresses();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;
  const canPollHelps = user?.role === "BOTH";
  const { data: helperOrders = [] } = useOrders("provider", { poll: canPollHelps, enabled: canPollHelps });
  const transition = useTransitionOrder();

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const origin = myLocation ?? (defaultAddress ? { lat: defaultAddress.lat, lng: defaultAddress.lng } : null);

  const [selectedHelpId, setSelectedHelpId] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const helpSheetRef = useRef<BottomSheetMethods>(null);

  useShareIdleLocation(helper.isOn);

  const activeOrder = helperOrders.find((order) => ACTIVE.includes(order.status));
  useShareLocationWhileEnRoute(
    activeOrder && activeOrder.status !== "AWAITING_CONFIRMATION" ? activeOrder.id : undefined,
  );

  const prevStatusRef = useRef<Map<string, OrderStatus>>(new Map());
  useEffect(() => {
    for (const order of helperOrders) {
      const prev = prevStatusRef.current.get(order.id);
      if (prev === "AWAITING_CONFIRMATION" && order.status === "COMPLETED") {
        router.push({ pathname: "/client/attend-rating/[id]", params: { id: order.id } });
      }
    }
    prevStatusRef.current = new Map(helperOrders.map((order) => [order.id, order.status]));
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

  const openHelps = useMemo(
    () =>
      helper.isOn
        ? helperOrders.filter((order) => order.status === "CREATED" && order.isOpenRequest && !order.provider)
        : [],
    [helper.isOn, helperOrders],
  );

  const selectedHelp = openHelps.find((order) => order.id === selectedHelpId) ?? null;
  const selectedDistance =
    selectedHelp && origin
      ? distanceKm(origin, { lat: selectedHelp.address.lat, lng: selectedHelp.address.lng })
      : null;
  const selectedMinutes = selectedHelp
    ? Math.max(0, Math.round((Date.now() - new Date(selectedHelp.createdAt).getTime()) / 60000))
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
          router.push({ pathname: "/client/attend/[id]", params: { id: order.id } });
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível atender agora."),
      },
    );
  };

  const runActive = () => {
    if (!activeOrder) return;
    const next = helperNextAction(activeOrder);
    if (!next) return;
    if (next.disabled) {
      if (activeOrder.status === "ACCEPTED" || activeOrder.status === "EN_ROUTE") {
        router.push({ pathname: "/client/attend/[id]", params: { id: activeOrder.id } });
      }
      return;
    }
    transition.mutate(
      { id: activeOrder.id, action: next.action },
      {
        onSuccess: (order) => {
          if (next.action === "start_route") {
            router.push({ pathname: "/client/attend/[id]", params: { id: order.id } });
          }
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível continuar."),
      },
    );
  };

  const next = activeOrder ? helperNextAction(activeOrder) : null;
  const attending = helper.isOn || helper.arming || activeOrder != null;

  return (
    <Screen>
      <RealMap
        markers={markers}
        center={origin ? [origin.lng, origin.lat] : undefined}
        variant="dark"
        cameraKey={cameraKey}
        zoom={14}
      />
      {(helper.isOn || helper.arming) && !activeOrder && <AttendRadar />}

      <View style={[styles.topArea, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.push("/client/profile" as never)}>
            <Avatar
              initials={initialsOf(user?.fullName ?? "?")}
              imageUri={user?.avatarUrl}
              color={theme.colors.primary}
              size={44}
            />
          </Pressable>

          <Pressable style={styles.locationBlock} onPress={() => router.push("/client/addresses")}>
            <View style={styles.locationLabelRow}>
              <Ionicons name="location" size={12} color={theme.colors.primary} />
              <Text style={styles.locationLabel}>Sua localização</Text>
            </View>
            <Text style={styles.locationValue} numberOfLines={1}>
              {defaultAddress ? `${locationCity}, ${locationStreet}` : locationStreet}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push("/client/notifications" as never)}>
            <View style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.foreground} />
              {hasUnread && <View style={[styles.bellDot, { backgroundColor: theme.colors.primary }]} />}
            </View>
          </Pressable>
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {helper.isOn && openHelps.length === 0 && !activeOrder && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              Nenhuma ajuda perto de você agora. Deixe o modo ligado.
            </Text>
          </View>
        )}

        {activeOrder && next && (
          <View style={styles.activeCard}>
            <Text style={styles.activeKicker}>Sua ajuda</Text>
            <Text style={styles.activeTitle} numberOfLines={2}>
              {helpTitle(activeOrder)}
            </Text>
            <Text style={styles.activeMeta}>{moneyFromCents(activeOrder.priceCents)}</Text>
            <SpinButton
              controlled
              isActive={transition.isPending && !selectedHelp}
              disabled={transition.isPending}
              idleText={next.label}
              activeText="Aguarde..."
              onPress={runActive}
              colors={{
                idle: {
                  background: next.disabled ? "rgba(255,255,255,0.08)" : theme.colors.primary,
                  text: "#fff",
                },
                active: { background: theme.colors.primary, text: "#fff" },
              }}
              buttonStyle={{ paddingVertical: 13, borderRadius: 14, fontSize: 15 }}
              spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
            />
          </View>
        )}

        {attendButton.ready && !attendButton.hidden && (
          <AttendFab active={helper.isOn} pending={helper.pending} onPress={helper.toggle} />
        )}

        <Pressable style={styles.locateBtn} onPress={() => origin && setCameraKey((k) => k + 1)}>
          <Ionicons name="locate" size={22} color={theme.colors.primary} />
        </Pressable>

        {!attending && (
          <Pressable
            style={({ pressed }) => [styles.searchBtn, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => router.push("/client/create-order" as never)}
          >
            <Ionicons name="hand-left" size={20} color={theme.colors.primaryForeground} />
            <Text style={styles.searchBtnText}>Pedir ajuda</Text>
          </Pressable>
        )}
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
  emptyHint: {
    alignSelf: "stretch",
    backgroundColor: "rgba(20,20,44,0.92)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyHintText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
    textAlign: "center",
    lineHeight: 19,
  },
  activeCard: {
    alignSelf: "stretch",
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 6,
  },
  activeKicker: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  activeTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  activeMeta: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 4,
  },
  locateBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtn: {
    alignSelf: "stretch",
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.primary,
  },
  searchBtnText: {
    color: theme.colors.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
}));
