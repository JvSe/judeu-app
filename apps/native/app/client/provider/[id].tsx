import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { initialsOf, priceFromCents } from "@/lib/format";
import { useProvider, useProviderReviews } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Screen } from "@/components/ui/screen";
import { StatCard } from "@/components/ui/stat-card";

export default function ProviderProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data: provider, isLoading } = useProvider(id);
  const { data: reviews = [] } = useProviderReviews(id);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  if (isLoading || !provider) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient colors={["#FF6600", "#d94f00"]} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["transparent", theme.colors.background]}
            style={styles.heroFade}
          />
        </View>

        <View style={styles.content}>
            <Avatar
              initials={initialsOf(provider.name)}
              color="#1c1c40"
              size={104}
              radius={30}
              fontSize={34}
            />
            <View style={styles.nameRow}>
              <Text style={styles.name}>{provider.name}</Text>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            </View>
            {provider.companyName && <Text style={styles.company}>{provider.companyName}</Text>}
            <Text style={styles.role}>{provider.role}</Text>
            <View style={[styles.availabilityChip, !provider.isAvailable && styles.availabilityChipOff]}>
              <View style={[styles.availabilityDot, !provider.isAvailable && styles.availabilityDotOff]} />
              <Text style={[styles.availabilityText, !provider.isAvailable && styles.availabilityTextOff]}>
                {provider.isAvailable ? "Disponível agora" : "Indisponível no momento"}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard value={provider.rating.toFixed(1)} label={`★ ${provider.reviews} aval.`} />
              <StatCard value={`${provider.yearsExperience} anos`} label="experiência" />
              <StatCard value={`${provider.services.length}`} label="serviços" />
            </View>

            <Text style={styles.sectionTitle}>Serviços</Text>
            <View style={{ gap: 10 }}>
              {provider.services.map((service) => {
                const selected = service.id === (selectedServiceId ?? provider.services[0]?.id);
                return (
                  <Pressable
                    key={service.id}
                    style={[styles.serviceRow, selected && styles.serviceRowSelected]}
                    onPress={() => setSelectedServiceId(service.id)}
                  >
                    <View style={[styles.serviceRadio, selected && styles.serviceRadioSelected]}>
                      {selected && <View style={styles.serviceRadioDot} />}
                    </View>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>{priceFromCents(service.priceCents)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Avaliações</Text>
            {reviews.length === 0 ? (
              <Text style={styles.emptyReviews}>Ainda não há avaliações para este prestador.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar initials={initialsOf(review.author.name)} color="#3a3a70" size={38} radius={12} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewAuthor}>{review.author.name}</Text>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <Ionicons
                              key={v}
                              name={v <= review.rating ? "star" : "star-outline"}
                              size={13}
                              color="#FF9a2e"
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </IconButton>
        <IconButton>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </IconButton>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View>
          <Text style={styles.footerLabel}>
            {selectedServiceId ? "Valor" : "A partir de"}
          </Text>
          <Text style={styles.footerPrice}>
            {priceFromCents(
              (provider.services.find((s) => s.id === selectedServiceId) ?? provider.services[0])
                ?.priceCents ?? provider.priceFromCents,
            )}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Contratar agora"
            onPress={() => {
              const selected =
                provider.services.find((s) => s.id === selectedServiceId) ?? provider.services[0];
              router.push({
                pathname: "/client/create-order",
                params: {
                  providerId: provider.id,
                  providerName: provider.name,
                  allowsNegotiation: String(provider.allowsNegotiation),
                  ...(selected
                    ? {
                        serviceId: selected.id,
                        serviceName: selected.name,
                        priceCents: String(selected.priceCents),
                      }
                    : {}),
                },
              });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    height: 220,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    marginTop: -70,
    paddingBottom: 140,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  name: {
    fontSize: 27,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  company: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 4,
  },
  role: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  availabilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    backgroundColor: "rgba(49,208,127,0.14)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  availabilityChipOff: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  availabilityDotOff: {
    backgroundColor: theme.colors.mutedForeground,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  availabilityTextOff: {
    color: theme.colors.mutedForeground,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 24,
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  serviceRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(28,28,58,0.95)",
  },
  serviceRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceRadioSelected: {
    borderColor: theme.colors.primary,
  },
  serviceRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  serviceName: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    color: "#e8e8f5",
  },
  servicePrice: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  emptyReviews: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  reviewCard: {
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 16,
    padding: 15,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  reviewAuthor: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#e8e8f5",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
    marginTop: 3,
  },
  reviewComment: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 19,
    marginTop: 11,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  footerLabel: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  footerPrice: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 2,
  },
}));
