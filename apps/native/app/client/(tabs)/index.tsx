import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { ProviderSheet } from "@/components/provider-sheet";
import { Avatar } from "@/components/ui/avatar";
import { GlassSurface } from "@/components/ui/glass-surface";
import { ProviderMarker, SelfMarker } from "@/components/ui/map-marker";
import { RealMap } from "@/components/ui/real-map";
import { Screen } from "@/components/ui/screen";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";
import { fonts } from "@/constants/fonts";
import {
  avatarColor,
  confirmCallPath,
  formatAddressLine,
  initialsOf,
  priceFromCents,
} from "@/lib/format";
import { useAddresses, useCategories, useNearbyProviders, useNotifications } from "@/lib/hooks";
import { useCurrentLocation } from "@/lib/location";
import { providerPinPosition } from "@/lib/nearby";

import { clientFloatingTabBarStyle } from "./_layout";

export default function ClientHome() {
  const navigation = useNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const myLocation = useCurrentLocation();
  const { data: addresses = [] } = useAddresses();
  const { data: categories = [] } = useCategories();
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.unreadCount ?? 0) > 0;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const origin = defaultAddress
    ? { lat: defaultAddress.lat, lng: defaultAddress.lng }
    : myLocation;
  const { data: providers = [] } = useNearbyProviders(origin, {
    categoryId: categoryId ?? undefined,
  });

  const providerSheetRef = useRef<BottomSheetMethods>(null);
  const tabBarRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [tabBarHiddenForSheet, setTabBarHiddenForSheet] = useState(false);

  const clearTabBarRestoreTimeout = () => {
    if (tabBarRestoreTimeoutRef.current) {
      clearTimeout(tabBarRestoreTimeoutRef.current);
      tabBarRestoreTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: tabBarHiddenForSheet ? { display: "none" } : clientFloatingTabBarStyle,
    });
    return () => {
      navigation.setOptions({ tabBarStyle: clientFloatingTabBarStyle });
      clearTabBarRestoreTimeout();
    };
  }, [navigation, tabBarHiddenForSheet]);

  const openProviderSheet = (providerId: string, snapIndex: number) => {
    clearTabBarRestoreTimeout();
    setSelectedProviderId(providerId);
    setTabBarHiddenForSheet(true);
    providerSheetRef.current?.snapToIndex(snapIndex);
  };

  const handleProviderSheetCloseStart = () => {
    clearTabBarRestoreTimeout();
    tabBarRestoreTimeoutRef.current = setTimeout(() => {
      setTabBarHiddenForSheet(false);
      tabBarRestoreTimeoutRef.current = null;
    }, 150);
  };

  const handleProviderSheetClose = () => {
    clearTabBarRestoreTimeout();
    setTabBarHiddenForSheet(false);
    setSelectedProviderId(null);
  };

  const selected = providers.find((p) => p.id === selectedProviderId);
  const locationLabel = defaultAddress
    ? formatAddressLine(defaultAddress)
    : myLocation
      ? "Sua localização"
      : "Definir endereço";

  const markers = [
    ...providers
      .map((p) => ({ p, pos: providerPinPosition(p) }))
      .filter((x): x is { p: (typeof providers)[number]; pos: { lat: number; lng: number } } => x.pos != null)
      .map(({ p, pos }, index) => ({
        id: p.id,
        lngLat: [pos.lng, pos.lat] as [number, number],
        render: () => (
          <ProviderMarker
            initials={initialsOf(p.name)}
            color={index === 0 ? "#FF6600" : "#3a3a70"}
            imageUri={p.avatarUrl}
            highlighted={index === 0}
          />
        ),
        onPress: () => openProviderSheet(p.id, 0),
      })),
    ...(origin
      ? [{ id: "self", lngLat: [origin.lng, origin.lat] as [number, number], render: () => <SelfMarker /> }]
      : []),
  ];

  const nextAvailable = providers[0];

  return (
    <Screen>
      <RealMap markers={markers} center={origin ? [origin.lng, origin.lat] : undefined} />

      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/client/addresses")}>
            <GlassSurface style={styles.locationPill}>
              <Ionicons name="location" size={16} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>SUA LOCALIZAÇÃO</Text>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {locationLabel}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
          <Pressable onPress={() => router.push("/client/notifications" as never)}>
            <GlassSurface style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {hasUnread && <View style={styles.bellDot} />}
            </GlassSurface>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.searchBar, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push("/client/ai/chat" as never)}
        >
          <Ionicons name="search" size={22} color="#fff" />
          <Text style={styles.searchText}>Do que você precisa hoje?</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Pressable
            style={[styles.chip, !categoryId && styles.chipOn]}
            onPress={() => setCategoryId(null)}
          >
            <Text style={[styles.chipText, !categoryId && styles.chipTextOn]}>Todas</Text>
          </Pressable>
          {categories.map((c) => {
            const on = c.id === categoryId;
            return (
              <Pressable key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setCategoryId(c.id)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.nearby}>
        <View style={styles.nearbyHeader}>
          <Text style={styles.nearbyTitle}>Pessoas perto de você</Text>
          {categoryId && nextAvailable ? (
            <Pressable
              onPress={() =>
                router.push(
                  confirmCallPath({
                    providerId: nextAvailable.id,
                    providerName: nextAvailable.name,
                    allowsNegotiation: nextAvailable.allowsNegotiation,
                    priceCents: nextAvailable.priceFromCents ?? undefined,
                    categoryId,
                  }),
                )
              }
            >
              <Text style={styles.nearbyLink}>Chamar o próximo</Text>
            </Pressable>
          ) : (
            <Text style={styles.nearbyLink}>{providers.length} online</Text>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {providers.slice(0, 8).map((provider, index) => (
            <Pressable
              key={provider.id}
              style={({ pressed }) => [styles.providerCard, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => openProviderSheet(provider.id, 0)}
            >
              <View style={styles.providerHeader}>
                <Avatar
                  initials={initialsOf(provider.name)}
                  imageUri={provider.avatarUrl}
                  color={avatarColor(index)}
                  size={46}
                  radius={14}
                />
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {provider.name}
                  </Text>
                  <Text style={styles.providerRole} numberOfLines={1}>
                    {provider.role}
                  </Text>
                </View>
              </View>
              <View style={styles.providerMeta}>
                <View style={styles.ratingChip}>
                  <Text style={styles.ratingText}>★ {provider.rating.toFixed(1)}</Text>
                </View>
                <Text style={styles.distanceText}>
                  {provider.etaMin != null
                    ? `~${provider.etaMin} min`
                    : provider.distanceKm != null
                      ? `${provider.distanceKm.toFixed(1)} km`
                      : `${provider.reviews} aval.`}
                </Text>
              </View>
              <View style={styles.providerFooter}>
                <Text style={styles.providerPrice}>{priceFromCents(provider.priceFromCents)}</Text>
                <View style={styles.viewButton}>
                  <Text style={styles.viewButtonText}>Chamar</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ProviderSheet
        ref={providerSheetRef}
        providerId={selectedProviderId}
        etaMin={selected?.etaMin}
        categoryId={categoryId}
        onCloseStart={handleProviderSheetCloseStart}
        onClose={handleProviderSheetClose}
      />
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
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: "rgba(28,28,58,0.92)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: "#fff",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  chipTextOn: {
    color: "#fff",
  },
  nearby: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
  providerInfo: {
    flex: 1,
    flexShrink: 1,
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
