import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { Order } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents, shortTime } from "@/lib/format";
import { useOrders, useTransitionOrder } from "@/lib/hooks";
import { useCurrentLocation, useShareLocationWhileEnRoute } from "@/lib/location";
import { Avatar } from "@/components/ui/avatar";
import { ProviderMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";

function orderTitle(order: Order): string {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

function addressLine(order: Order): string {
  const { street, number, neighborhood, city, state } = order.address;
  return `${street}${number ? `, ${number}` : ""}${neighborhood ? ` · ${neighborhood}` : ""} · ${city}/${state}`;
}

export default function ProviderMap() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const { data: orders = [] } = useOrders("provider");
  const transition = useTransitionOrder();
  const myLocation = useCurrentLocation();

  const newOrder = orders.find((o) => o.status === "CREATED");
  const activeOrder = orders.find(
    (o) => o.status === "ACCEPTED" || o.status === "EN_ROUTE" || o.status === "IN_PROGRESS",
  );
  useShareLocationWhileEnRoute(
    activeOrder?.status === "ACCEPTED" || activeOrder?.status === "EN_ROUTE"
      ? activeOrder.id
      : undefined,
  );

  const act = (id: string, action: "accept" | "reject") => transition.mutate({ id, action });

  const selfCoord: [number, number] | null = myLocation ? [myLocation.lng, myLocation.lat] : null;
  const destCoord: [number, number] | null = activeOrder
    ? [activeOrder.address.lng, activeOrder.address.lat]
    : null;

  const markers = [
    ...(selfCoord ? [{ id: "self", lngLat: selfCoord, render: () => <SelfMarker /> }] : []),
    ...(destCoord
      ? [
          {
            id: "client",
            lngLat: destCoord,
            render: () => (
              <View style={styles.clientPinBubble}>
                <Text style={styles.clientPinText}>
                  {activeOrder?.tracking.distanceKm != null
                    ? `Cliente · ${activeOrder.tracking.distanceKm.toFixed(1)} km`
                    : "Cliente"}
                </Text>
              </View>
            ),
          },
        ]
      : []),
  ];

  const bounds: [number, number, number, number] | undefined =
    selfCoord && destCoord
      ? [
          Math.min(selfCoord[0], destCoord[0]),
          Math.min(selfCoord[1], destCoord[1]),
          Math.max(selfCoord[0], destCoord[0]),
          Math.max(selfCoord[1], destCoord[1]),
        ]
      : undefined;

  return (
    <Screen>
      <RealMap
        markers={markers}
        route={activeOrder?.tracking.route}
        center={!bounds ? (selfCoord ?? undefined) : undefined}
        bounds={bounds}
      />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.onlinePill} onPress={() => setOnline((v) => !v)}>
          <View style={[styles.onlineDot, !online && styles.onlineDotOff]} />
          <Text style={[styles.onlineText, !online && styles.onlineTextOff]}>
            {online ? "Online" : "Offline"}
          </Text>
          <View style={[styles.toggle, online ? styles.toggleOn : styles.toggleOff]}>
            <View style={[styles.knob, online ? styles.knobOn : styles.knobOff]} />
          </View>
        </Pressable>
        <View style={styles.earningsPill}>
          <Ionicons name="logo-usd" size={15} color={theme.colors.primary} />
          <Text style={styles.earningsPillText}>R$ 350 hoje</Text>
        </View>
      </View>

      {newOrder && online && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>NOVA CHAMADA</Text>
            </View>
          </View>

          <View style={styles.requestBody}>
            <Avatar initials={initialsOf(newOrder.client.name)} color="#3a3a70" size={54} radius={16} />
            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>{orderTitle(newOrder)}</Text>
              <Text style={styles.requestMeta}>
                {newOrder.client.name} · {shortTime(newOrder.createdAt)}
              </Text>
            </View>
            <Text style={styles.requestPrice}>{moneyFromCents(newOrder.totalCents)}</Text>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={theme.colors.mutedForeground} />
            <Text style={styles.addressText}>{addressLine(newOrder)}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.declineButton}
              onPress={() => act(newOrder.id, "reject")}
              disabled={transition.isPending}
            >
              <Text style={styles.declineText}>Recusar</Text>
            </Pressable>
            <Pressable
              style={styles.acceptButton}
              onPress={() => act(newOrder.id, "accept")}
              disabled={transition.isPending}
            >
              <Text style={styles.acceptText}>Aceitar chamada</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  clientPinBubble: {
    backgroundColor: "#fff",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  clientPinText: {
    fontSize: 12.5,
    fontFamily: fonts.extraBold,
    color: "#0d0d24",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.4)",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
  },
  onlineDotOff: {
    backgroundColor: theme.colors.mutedForeground,
  },
  onlineText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  onlineTextOff: {
    color: theme.colors.mutedForeground,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: theme.colors.success,
  },
  toggleOff: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    position: "absolute",
  },
  knobOn: {
    right: 3,
  },
  knobOff: {
    left: 3,
  },
  earningsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  earningsPillText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#14142e",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  statusText: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  requestBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  requestTitle: {
    fontSize: 16.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  requestMeta: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 3,
  },
  requestPrice: {
    fontSize: 21,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  addressText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  actions: {
    flexDirection: "row",
    gap: 11,
    marginTop: 15,
  },
  declineButton: {
    width: 110,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 15,
  },
  declineText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#c9c7e4",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 15,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  acceptText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
}));
