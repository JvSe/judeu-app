import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useOrder, useTransitionOrder } from "@/lib/hooks";
import { openGoogleMapsNavigation, openWazeNavigation } from "@/lib/external-maps";
import { useShareLocationWhileEnRoute, useWatchCurrentLocation } from "@/lib/location";
import { IconButton } from "@/components/ui/icon-button";
import { SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";

function orderTitle(order: { service?: { name: string } | null; category?: { name: string } | null; description?: string | null }) {
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

export default function ProviderDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: order, isLoading } = useOrder(id, { poll: true });
  const transition = useTransitionOrder();
  const myLocation = useWatchCurrentLocation();
  const [pendingAction, setPendingAction] = useState<"start_route" | "start_work" | null>(null);

  const shareOrderId =
    order?.status === "ACCEPTED" || order?.status === "EN_ROUTE" ? order.id : undefined;
  useShareLocationWhileEnRoute(shareOrderId);

  useEffect(() => {
    if (!order) return;
    if (order.status === "IN_PROGRESS" || order.status === "COMPLETED" || order.status === "CANCELLED") {
      router.replace("/provider" as never);
    }
  }, [order]);

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (order.status === "IN_PROGRESS" || order.status === "COMPLETED" || order.status === "CANCELLED") {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const { lat: destLat, lng: destLng } = order.address;
  const destCoord: [number, number] = [destLng, destLat];
  const { distanceKm, etaMin, route, arrived } = order.tracking;

  const selfLat = myLocation?.lat ?? order.tracking.providerLat;
  const selfLng = myLocation?.lng ?? order.tracking.providerLng;
  const selfCoord: [number, number] | null =
    selfLat != null && selfLng != null ? [selfLng, selfLat] : null;

  const markers = [
    ...(selfCoord
      ? [{ id: "self", lngLat: selfCoord, render: () => <SelfMarker /> }]
      : []),
    {
      id: "client",
      lngLat: destCoord,
      render: () => (
        <View style={styles.clientPin}>
          <Ionicons name="home" size={17} color="#000052" />
        </View>
      ),
    },
  ];

  const bounds: [number, number, number, number] | undefined = selfCoord
    ? [
        Math.min(selfCoord[0], destCoord[0]),
        Math.min(selfCoord[1], destCoord[1]),
        Math.max(selfCoord[0], destCoord[0]),
        Math.max(selfCoord[1], destCoord[1]),
      ]
    : undefined;

  const runTransition = (action: "start_route" | "start_work") => {
    setPendingAction(action);
    transition.mutate(
      { id: order.id, action },
      {
        onSuccess: () => {
          if (action === "start_work") {
            router.back();
          }
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível completar a ação."),
        onSettled: () => setPendingAction(null),
      },
    );
  };

  const dest = { lat: destLat, lng: destLng };

  return (
    <Screen>
      <RealMap
        markers={markers}
        route={route}
        center={!bounds ? destCoord : undefined}
        bounds={bounds}
      />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </IconButton>
        <View style={styles.statusPill}>
          <Text style={styles.statusText} numberOfLines={1}>
            {order.status === "ACCEPTED" ? "Pronto para ir" : "A caminho do cliente"}
          </Text>
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{orderTitle(order)}</Text>
        <Text style={styles.subtitle}>{order.client.name}</Text>

        {order.status === "EN_ROUTE" && (
          <View style={styles.metricsRow}>
            <Text style={styles.etaText}>
              {etaMin != null ? `${etaMin} min` : "Calculando..."}
            </Text>
            {distanceKm != null && (
              <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>
            )}
          </View>
        )}

        <View style={styles.externalRow}>
          <Pressable
            style={styles.externalButton}
            onPress={() => openGoogleMapsNavigation(dest, myLocation)}
          >
            <Ionicons name="map-outline" size={18} color="#fff" />
            <Text style={styles.externalLabel}>Google Maps</Text>
          </Pressable>
          <Pressable style={styles.externalButton} onPress={() => openWazeNavigation(dest)}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.externalLabel}>Waze</Text>
          </Pressable>
        </View>

        {order.status === "ACCEPTED" && (
          <SpinButton
            controlled
            isActive={pendingAction === "start_route" && transition.isPending}
            disabled={transition.isPending}
            idleText="Iniciar trajeto"
            activeText="Iniciando..."
            onPress={() => runTransition("start_route")}
            colors={{
              idle: { background: theme.colors.primary, text: "#fff" },
              active: { background: theme.colors.primary, text: "#fff" },
            }}
            buttonStyle={{ paddingVertical: 14, borderRadius: 14, fontSize: 15 }}
            spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
          />
        )}

        {order.status === "EN_ROUTE" && (
          <SpinButton
            controlled
            isActive={pendingAction === "start_work" && transition.isPending}
            disabled={transition.isPending || !arrived}
            idleText={arrived ? "Cheguei — iniciar serviço" : "Aguardando chegada ao local..."}
            activeText="Confirmando..."
            onPress={() => runTransition("start_work")}
            colors={{
              idle: {
                background: arrived ? theme.colors.success : "rgba(255,255,255,0.1)",
                text: "#fff",
              },
              active: { background: theme.colors.success, text: "#fff" },
            }}
            buttonStyle={{ paddingVertical: 14, borderRadius: 14, fontSize: 15 }}
            spinnerConfig={{ color: "#fff", containerBackground: theme.colors.success }}
          />
        )}

        <Pressable
          style={styles.chatLink}
          onPress={() => router.push({ pathname: "/provider/chat/[id]", params: { id: order.id } })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.chatLinkText}>Chat com o cliente</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  clientPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  statusPill: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  statusText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: -6,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  etaText: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  distanceText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  externalRow: {
    flexDirection: "row",
    gap: 10,
  },
  externalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  externalLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  chatLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  chatLinkText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
}));
