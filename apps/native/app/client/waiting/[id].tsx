import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Avatar } from "@/components/ui/avatar";
import { ProviderMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents, priceFromCents } from "@/lib/format";
import { useNearbyProviders, useOrder, useReassignOrder, useTransitionOrder } from "@/lib/hooks";
import { providerPinPosition } from "@/lib/nearby";

export default function WaitingCall() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: order, isLoading } = useOrder(id, { poll: true });
  const transition = useTransitionOrder();
  const reassign = useReassignOrder();
  const [now, setNow] = useState(Date.now());

  const origin = order ? { lat: order.address.lat, lng: order.address.lng } : null;
  const { data: nearby = [] } = useNearbyProviders(origin, {
    categoryId: order?.category?.id,
    excludeProviderId: order?.provider?.id,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!order) return;
    if (order.status === "ACCEPTED") {
      router.replace({ pathname: "/client/payment/[id]", params: { id: order.id } });
    } else if (order.status === "EN_ROUTE" || order.status === "IN_PROGRESS") {
      router.replace({ pathname: "/client/tracking/[id]", params: { id: order.id } });
    } else if (order.status === "CANCELLED") {
      // stay — offer next person
    }
  }, [order?.status, order?.id]);

  const remainingMs = order ? new Date(order.offerExpiresAt).getTime() - now : 0;
  const expired = remainingMs <= 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

  const providerPos = useMemo(() => {
    if (order?.tracking.providerLat != null && order.tracking.providerLng != null) {
      return { lat: order.tracking.providerLat, lng: order.tracking.providerLng };
    }
    return null;
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

  const dest: [number, number] = [order.address.lng, order.address.lat];
  const providerCoord: [number, number] | null = providerPos
    ? [providerPos.lng, providerPos.lat]
    : null;

  const markers = [
    { id: "home", lngLat: dest, render: () => <SelfMarker /> },
    ...(providerCoord
      ? [
          {
            id: "provider",
            lngLat: providerCoord,
            render: () => (
              <ProviderMarker
                initials={initialsOf(order.provider?.name ?? "?")}
                color="#FF6600"
                imageUri={order.provider?.avatarUrl}
                highlighted
              />
            ),
          },
        ]
      : []),
  ];

  const cancelled = order.status === "CANCELLED";
  const waiting = order.status === "CREATED";
  const openWait = order.isOpenRequest && !order.provider;

  return (
    <Screen>
      <RealMap markers={markers} center={dest} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.replace("/client")} hitSlop={10} style={styles.back}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        {waiting && openWait ? (
          <>
            <Text style={styles.status}>Aguardando alguém perto atender…</Text>
            <Text style={styles.meta}>
              {order.description ?? "Solicitação"} · {order.totalCents > 0 ? moneyFromCents(order.totalCents) : "a combinar"}
            </Text>
            <Pressable
              style={styles.cancel}
              onPress={() =>
                Alert.alert("Cancelar solicitação", "Quer mesmo cancelar?", [
                  { text: "Não" },
                  {
                    text: "Cancelar",
                    style: "destructive",
                    onPress: () =>
                      transition.mutate(
                        { id: order.id, action: "cancel" },
                        { onSuccess: () => router.replace("/client") },
                      ),
                  },
                ])
              }
            >
              <Text style={styles.cancelText}>Cancelar solicitação</Text>
            </Pressable>
          </>
        ) : waiting && !expired ? (
          <>
            <Text style={styles.status}>Aguardando {order.provider?.name?.split(" ")[0]} aceitar…</Text>
            <Text style={styles.timer}>{remainingSec}s</Text>
            <Text style={styles.meta}>
              {order.service?.name ?? "Chamada"} · {moneyFromCents(order.totalCents)}
            </Text>
            <Pressable
              style={styles.cancel}
              onPress={() =>
                Alert.alert("Cancelar chamada", "Quer mesmo cancelar?", [
                  { text: "Não" },
                  {
                    text: "Cancelar",
                    style: "destructive",
                    onPress: () =>
                      transition.mutate(
                        { id: order.id, action: "cancel" },
                        { onSuccess: () => router.replace("/client") },
                      ),
                  },
                ])
              }
            >
              <Text style={styles.cancelText}>Cancelar chamada</Text>
            </Pressable>
          </>
        ) : null}

        {!openWait && ((expired && waiting) || cancelled) ? (
          <>
            <Text style={styles.status}>
              {cancelled ? "Essa pessoa recusou." : "Essa pessoa não respondeu."}
            </Text>
            <Text style={styles.meta}>Chame a próxima perto de você.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {nearby.slice(0, 6).map((person) => {
                const pin = providerPinPosition(person);
                return (
                  <Pressable
                    key={person.id}
                    style={styles.nextCard}
                    onPress={() => {
                      if (waiting) {
                        reassign.mutate(
                          { id: order.id, providerId: person.id },
                          {
                            onError: (err) =>
                              Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível chamar."),
                          },
                        );
                      } else {
                        router.replace({
                          pathname: "/client/create-order",
                          params: {
                            providerId: person.id,
                            providerName: person.name,
                            allowsNegotiation: String(person.allowsNegotiation),
                            ...(person.priceFromCents != null
                              ? { priceCents: String(person.priceFromCents) }
                              : {}),
                          },
                        });
                      }
                    }}
                  >
                    <Avatar initials={initialsOf(person.name)} imageUri={person.avatarUrl} size={42} radius={14} />
                    <Text style={styles.nextName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={styles.nextMeta}>
                      {person.etaMin ? `~${person.etaMin} min` : pin ? "" : "Perto"}
                      {person.priceFromCents != null ? ` · ${priceFromCents(person.priceFromCents)}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {nearby.length === 0 && (
              <Text style={styles.meta}>Ninguém mais disponível neste momento.</Text>
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  top: {
    position: "absolute",
    left: 16,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(20,20,46,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#14142e",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
  },
  status: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  timer: {
    marginTop: 6,
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  meta: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  cancel: {
    marginTop: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    color: theme.colors.mutedForeground,
    fontFamily: fonts.bold,
  },
  row: {
    gap: 10,
    paddingVertical: 16,
  },
  nextCard: {
    width: 140,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  nextName: {
    color: "#fff",
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  nextMeta: {
    color: theme.colors.mutedForeground,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
}));
