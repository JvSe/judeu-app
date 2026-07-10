import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { OrderStatus } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { initialsOf } from "@/lib/format";
import { useOrder } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { ProviderMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "ACCEPTED", label: "Aceito" },
  { status: "EN_ROUTE", label: "A caminho" },
  { status: "IN_PROGRESS", label: "Chegou" },
];

function statusMessage(status: OrderStatus, providerFirstName: string): string {
  switch (status) {
    case "ACCEPTED":
      return `${providerFirstName} aceitou o pedido`;
    case "EN_ROUTE":
      return `${providerFirstName} está a caminho`;
    case "IN_PROGRESS":
      return `${providerFirstName} está no local`;
    case "COMPLETED":
      return "Serviço concluído";
    default:
      return "Aguardando prestador";
  }
}

export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: order, isLoading } = useOrder(id, { poll: true });

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const providerName = order.provider?.name ?? "Prestador";
  const providerFirstName = providerName.split(" ")[0];
  const currentIndex = STEPS.findIndex((s) => s.status === order.status);
  const { distanceKm, etaMin, providerLat, providerLng, route } = order.tracking;
  const { lat: destLat, lng: destLng } = order.address;

  const providerCoord: [number, number] | null =
    providerLat != null && providerLng != null ? [providerLng, providerLat] : null;
  const destCoord: [number, number] = [destLng, destLat];

  const markers = [
    ...(providerCoord
      ? [
          {
            id: "provider",
            lngLat: providerCoord,
            render: () => (
              <ProviderMarker initials={initialsOf(providerName)} color="#3a3a70" highlighted size={48} />
            ),
          },
        ]
      : []),
    {
      id: "destination",
      lngLat: destCoord,
      render: () => (
        <View style={styles.destinationPin}>
          <Ionicons name="home" size={17} color="#000052" />
        </View>
      ),
    },
  ];

  const bounds: [number, number, number, number] | undefined = providerCoord
    ? [
        Math.min(providerCoord[0], destCoord[0]),
        Math.min(providerCoord[1], destCoord[1]),
        Math.max(providerCoord[0], destCoord[0]),
        Math.max(providerCoord[1], destCoord[1]),
      ]
    : undefined;

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
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusMessage(order.status, providerFirstName)}</Text>
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.etaText}>
            {etaMin != null ? `Chega em ${etaMin} min` : "Calculando chegada..."}
          </Text>
          {distanceKm != null && (
            <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>
          )}
        </View>

        <View style={styles.progressRow}>
          {STEPS.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <View key={step.status} style={{ flexDirection: "row", flex: index === STEPS.length - 1 ? 0 : 1, alignItems: "center" }}>
                <View
                  style={[
                    styles.progressDot,
                    done && styles.progressDotDone,
                    active && styles.progressDotActive,
                    !done && !active && styles.progressDotPending,
                  ]}
                >
                  {done && <Ionicons name="checkmark" size={11} color="#fff" />}
                </View>
                {index < STEPS.length - 1 && (
                  <View style={[styles.progressBar, done && styles.progressBarDone]} />
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.progressLabels}>
          {STEPS.map((step, index) => (
            <Text
              key={step.status}
              style={
                index < currentIndex
                  ? styles.progressLabelDone
                  : index === currentIndex
                    ? styles.progressLabelActive
                    : styles.progressLabelPending
              }
            >
              {step.label}
            </Text>
          ))}
        </View>

        <View style={styles.providerRow}>
          <Avatar initials={initialsOf(providerName)} color="#3a3a70" size={52} radius={16} />
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{providerName}</Text>
            <Text style={styles.providerRole}>
              {order.provider?.headline ?? "Serviço"} · ★ {(order.provider?.ratingAvg ?? 0).toFixed(1)}
            </Text>
          </View>
          <IconButton
            variant="solid"
            size={48}
            onPress={() => router.push({ pathname: "/client/chat/[id]", params: { id: order.id } })}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          </IconButton>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  destinationPin: {
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
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
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
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  etaText: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  distanceText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotDone: {
    backgroundColor: theme.colors.success,
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: "rgba(255,102,0,0.3)",
  },
  progressDotPending: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 6,
  },
  progressBarDone: {
    backgroundColor: theme.colors.success,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  progressLabelDone: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  progressLabelActive: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  progressLabelPending: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  providerName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  providerRole: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
}));
