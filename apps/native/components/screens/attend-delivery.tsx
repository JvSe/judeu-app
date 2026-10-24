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

function orderTitle(order: {
  service?: { name: string } | null;
  category?: { name: string } | null;
  description?: string | null;
  isOpenRequest?: boolean;
}) {
  if (order.isOpenRequest && order.description) return order.description;
  return order.service?.name ?? order.category?.name ?? order.description ?? "Serviço";
}

type AttendDeliveryProps = {
  exitTo: "/provider" | "/client";
  chatPathname: "/provider/chat/[id]" | "/client/chat/[id]";
  startLabel?: string;
  /** Quem atende pelo app do cliente volta ao mapa em vez de desempilhar. */
  replaceOnStartWork?: boolean;
};

export function AttendDelivery({
  exitTo,
  chatPathname,
  startLabel = "Iniciar trajeto",
  replaceOnStartWork = false,
}: AttendDeliveryProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: order, isLoading } = useOrder(id, { poll: true });
  const transition = useTransitionOrder();
  const myLocation = useWatchCurrentLocation();
  const [pendingAction, setPendingAction] = useState<"accept" | "start_route" | "start_work" | null>(
    null,
  );

  const shareOrderId =
    order?.status === "ACCEPTED" || order?.status === "EN_ROUTE" || order?.status === "IN_PROGRESS"
      ? order.id
      : undefined;
  useShareLocationWhileEnRoute(shareOrderId);

  const leave =
    order?.status === "IN_PROGRESS" ||
    order?.status === "AWAITING_CONFIRMATION" ||
    order?.status === "COMPLETED" ||
    order?.status === "CANCELLED";

  useEffect(() => {
    if (!leave) return;
    router.replace(exitTo as never);
  }, [leave, exitTo]);

  if (isLoading || !order || leave) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const canStart = order.payment?.status === "PAID" || order.payment?.method === "CASH";

  const goingToPickup =
    !!order.pickupAddress && (order.status === "ACCEPTED" || order.status === "EN_ROUTE");
  const destAddress = goingToPickup ? order.pickupAddress! : order.address;
  const { lat: destLat, lng: destLng } = destAddress;
  const destCoord: [number, number] = [destLng, destLat];
  const { distanceKm, etaMin, route, arrived } = order.tracking;

  const selfLat = myLocation?.lat ?? order.tracking.providerLat;
  const selfLng = myLocation?.lng ?? order.tracking.providerLng;
  const selfCoord: [number, number] | null =
    selfLat != null && selfLng != null ? [selfLng, selfLat] : null;

  const markers = [
    ...(selfCoord ? [{ id: "self", lngLat: selfCoord, render: () => <SelfMarker /> }] : []),
    {
      id: "client",
      lngLat: destCoord,
      render: () => (
        <View style={styles.clientPin}>
          <Ionicons name={goingToPickup ? "cube" : "home"} size={17} color="#000052" />
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

  const runTransition = (action: "accept" | "start_route" | "start_work") => {
    setPendingAction(action);
    transition.mutate(
      { id: order.id, action },
      {
        onSuccess: () => {
          if (action === "start_work") {
            if (replaceOnStartWork) router.replace(exitTo as never);
            else router.back();
          }
        },
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível completar a ação."),
        onSettled: () => setPendingAction(null),
      },
    );
  };

  const dest = { lat: destLat, lng: destLng };
  const waitingDetails = order.isOpenRequest && !order.detailsReady;

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
            {order.status === "CREATED"
              ? "Nova ajuda"
              : order.status === "ACCEPTED"
                ? canStart
                  ? "Pronto para ir"
                  : "Aguardando pagamento"
                : goingToPickup
                  ? "A caminho da busca"
                  : "A caminho do cliente"}
          </Text>
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{orderTitle(order)}</Text>
        <Text style={styles.subtitle}>{order.client.name}</Text>
        <Text style={styles.address}>
          {order.provider
            ? `${destAddress.street}${destAddress.number ? `, ${destAddress.number}` : ""}${destAddress.neighborhood ? ` · ${destAddress.neighborhood}` : ""} · ${destAddress.city}`
            : [destAddress.neighborhood, destAddress.city].filter(Boolean).join(" · ")}
        </Text>

        {order.status === "EN_ROUTE" && (
          <View style={styles.metricsRow}>
            <Text style={styles.etaText}>{etaMin != null ? `${etaMin} min` : "Calculando..."}</Text>
            {distanceKm != null && <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>}
          </View>
        )}

        {order.provider && (
        <View style={styles.externalRow}>
          <Pressable style={styles.externalButton} onPress={() => openGoogleMapsNavigation(dest, myLocation)}>
            <Ionicons name="map-outline" size={18} color="#fff" />
            <Text style={styles.externalLabel}>Google Maps</Text>
          </Pressable>
          <Pressable style={styles.externalButton} onPress={() => openWazeNavigation(dest)}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.externalLabel}>Waze</Text>
          </Pressable>
        </View>
        )}

        {order.status === "CREATED" && order.isOpenRequest && !order.provider && (
          <SpinButton
            controlled
            isActive={pendingAction === "accept" && transition.isPending}
            disabled={transition.isPending}
            idleText="Atender esta ajuda"
            activeText="Pegando..."
            onPress={() => runTransition("accept")}
            colors={{
              idle: { background: theme.colors.primary, text: "#fff" },
              active: { background: theme.colors.primary, text: "#fff" },
            }}
            buttonStyle={{ paddingVertical: 14, borderRadius: 14, fontSize: 15 }}
            spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
          />
        )}

        {order.status === "ACCEPTED" && !canStart && (
          <Text style={styles.waitPay}>A pessoa ainda está confirmando o pagamento.</Text>
        )}

        {order.status === "ACCEPTED" && canStart && waitingDetails && (
          <Text style={styles.waitPay}>Aguardando a pessoa combinar o local ou o chat.</Text>
        )}

        {order.status === "ACCEPTED" && (
          <SpinButton
            controlled
            isActive={pendingAction === "start_route" && transition.isPending}
            disabled={transition.isPending || !canStart || waitingDetails}
            idleText={!canStart ? "Aguardando pagamento" : waitingDetails ? "Aguardando detalhes" : startLabel}
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
            idleText={
              arrived
                ? "Cheguei, começar"
                : goingToPickup
                  ? "Aguardando chegada na busca"
                  : "Aguardando chegada"
            }
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

        {order.provider && (
          <Pressable
            style={styles.chatLink}
            onPress={() => router.push({ pathname: chatPathname, params: { id: order.id } })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.chatLinkText}>Conversar</Text>
          </Pressable>
        )}
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
  waitPay: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
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
  address: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
    marginTop: -4,
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
