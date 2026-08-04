import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useNotifications, useProviders } from "@/lib/hooks";
import { useCurrentLocation } from "@/lib/location";
import { distanceKm, distributeNearby } from "@/lib/nearby";
import { avatarColor, initialsOf, priceFromCents } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ProviderMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";

export default function ClientHome() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: providers = [] } = useProviders();
  const myLocation = useCurrentLocation();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;

  // Posições reais dos prestadores são mockadas (baseLat/baseLng fixos no
  // seed) — reposiciona num raio de 1km ao redor do usuário pra demo fazer
  // sentido em qualquer cidade.
  const nearbyPositions = useMemo(() => {
    if (!myLocation || providers.length === 0) return null;
    return distributeNearby(
      myLocation,
      providers.map((p) => p.id),
      1,
    );
  }, [myLocation, providers]);

  // Ordena pela distância mockada (mais perto primeiro) pra "Perto de você"
  // refletir o mesmo raio de 1km usado no mapa.
  const nearbyProviders = useMemo(() => {
    if (!myLocation || !nearbyPositions) return providers;
    return [...providers].sort((a, b) => {
      const posA = nearbyPositions.get(a.id);
      const posB = nearbyPositions.get(b.id);
      if (!posA || !posB) return 0;
      return distanceKm(myLocation, posA) - distanceKm(myLocation, posB);
    });
  }, [providers, myLocation, nearbyPositions]);

  const markers = [
    ...providers
      .filter((p) => nearbyPositions?.has(p.id) ?? (p.baseLat != null && p.baseLng != null))
      .map((p, index) => {
        const position = nearbyPositions?.get(p.id) ?? { lat: p.baseLat as number, lng: p.baseLng as number };
        return {
          id: p.id,
          lngLat: [position.lng, position.lat] as [number, number],
          render: () => (
            <ProviderMarker
              initials={initialsOf(p.name)}
              color={index === 0 ? "#FF6600" : "#3a3a70"}
              highlighted={index === 0}
            />
          ),
          onPress: () => router.push({ pathname: "/client/provider/[id]", params: { id: p.id } }),
        };
      }),
    ...(myLocation
      ? [
          {
            id: "self",
            lngLat: [myLocation.lng, myLocation.lat] as [number, number],
            render: () => <SelfMarker />,
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <RealMap
        markers={markers}
        center={myLocation ? [myLocation.lng, myLocation.lat] : undefined}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <GlassSurface style={styles.locationPill}>
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <View>
              <Text style={styles.locationLabel}>SUA LOCALIZAÇÃO</Text>
              <Text style={styles.locationValue}>
                {myLocation ? "Sua localização" : "Localização indisponível"}
              </Text>
            </View>
          </GlassSurface>
          <Pressable onPress={() => router.push("/client/notifications" as never)}>
            <GlassSurface style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {hasUnread && <View style={styles.bellDot} />}
            </GlassSurface>
          </Pressable>
          <Pressable onPress={() => router.push("/client/profile")}>
            <Avatar initials="VC" size={50} radius={16} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.searchBar, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push("/client/ai/offer" as never)}
        >
          <Ionicons name="search" size={22} color="#fff" />
          <Text style={styles.searchText}>Do que você precisa hoje?</Text>
        </Pressable>
      </View>

      <View style={styles.nearby}>
        <View style={styles.nearbyHeader}>
          <Text style={styles.nearbyTitle}>Perto de você</Text>
          <Text style={styles.nearbyLink}>Ver mapa</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {nearbyProviders.slice(0, 2).map((provider, index) => {
            const position = nearbyPositions?.get(provider.id);
            const distanceLabel =
              myLocation && position ? `${distanceKm(myLocation, position).toFixed(1)} km` : `${provider.reviews} avaliações`;
            return (
              <Pressable
                key={provider.id}
                style={({ pressed }) => [styles.providerCard, { opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push({ pathname: "/client/provider/[id]", params: { id: provider.id } })}
              >
                <View style={styles.providerHeader}>
                  <Avatar initials={initialsOf(provider.name)} color={avatarColor(index)} size={46} radius={14} />
                  <View>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerRole}>{provider.role}</Text>
                  </View>
                </View>
                <View style={styles.providerMeta}>
                  <View style={styles.ratingChip}>
                    <Text style={styles.ratingText}>★ {provider.rating}</Text>
                  </View>
                  <Text style={styles.distanceText}>{distanceLabel}</Text>
                </View>
                <View style={styles.providerFooter}>
                  <Text style={styles.providerPrice}>{priceFromCents(provider.priceFromCents)}</Text>
                  <View style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>Ver</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
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
  locationPill: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 15,
  },
  bellButton: {
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
  locationLabel: {
    fontSize: 10.5,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.bold,
    lineHeight: 12,
  },
  locationValue: {
    fontSize: 14,
    color: "#fff",
    fontFamily: fonts.bold,
    marginTop: 2,
  },
  searchBar: {
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
  searchText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  nearby: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    paddingHorizontal: 16,
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  nearbyTitle: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  nearbyLink: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  cardsRow: {
    gap: 12,
  },
  providerCard: {
    width: 220,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: theme.borderRadius.xxl,
    padding: 15,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  providerName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  providerRole: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  providerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  ratingChip: {
    backgroundColor: "rgba(255,102,0,0.16)",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  ratingText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontFamily: fonts.extraBold,
  },
  distanceText: {
    color: theme.colors.mutedForeground,
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
  },
  providerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  providerPrice: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  viewButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewButtonText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: fonts.bold,
  },
}));
