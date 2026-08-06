import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { forwardRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { initialsOf, priceFromCents } from "@/lib/format";
import { useProvider, useProviderReviews } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import { StatCard } from "@/components/ui/stat-card";
import { BottomSheet } from "@/components/ui/templates/bottom-sheet";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";

type ProviderSheetProps = {
  providerId: string | null;
  onCloseStart?: () => void;
  onClose: () => void;
};

export const ProviderSheet = forwardRef<BottomSheetMethods, ProviderSheetProps>(
  ({ providerId, onCloseStart, onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const { theme } = useUnistyles();
    const { data: provider, isLoading } = useProvider(providerId ?? "");
    const { data: reviews = [] } = useProviderReviews(providerId ?? "");

    return (
      <BottomSheet
        ref={ref}
        snapPoints={["60%", "92%"]}
        backgroundColor={theme.colors.background}
        onCloseStart={onCloseStart}
        onClose={onClose}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
      >
        {!provider || isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <View>
            <View style={styles.headerRow}>
              <Avatar
                initials={initialsOf(provider.name)}
                color="#1c1c40"
                size={64}
                radius={20}
                fontSize={22}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {provider.name}
                  </Text>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                </View>
                {provider.companyName && <Text style={styles.company}>{provider.companyName}</Text>}
                <Text style={styles.role}>{provider.role}</Text>
              </View>
            </View>

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
              {provider.services.map((service) => (
                <View key={service.id} style={styles.serviceRow}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.servicePrice}>{priceFromCents(service.priceCents)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Avaliações</Text>
            {reviews.length === 0 ? (
              <Text style={styles.emptyReviews}>Ainda não há avaliações para este prestador.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar initials={initialsOf(review.author.name)} color="#3a3a70" size={34} radius={11} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewAuthor}>{review.author.name}</Text>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <Ionicons
                              key={v}
                              name={v <= review.rating ? "star" : "star-outline"}
                              size={12}
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

            <View style={styles.footer}>
              <View>
                <Text style={styles.footerLabel}>A partir de</Text>
                <Text style={styles.footerPrice}>{priceFromCents(provider.priceFromCents)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Contratar agora"
                  onPress={() => {
                    const cheapest = provider.services[0];
                    onClose();
                    router.push({
                      pathname: "/client/create-order",
                      params: {
                        providerId: provider.id,
                        providerName: provider.name,
                        allowsNegotiation: String(provider.allowsNegotiation),
                        ...(cheapest
                          ? {
                              serviceId: cheapest.id,
                              serviceName: cheapest.name,
                              priceCents: String(cheapest.priceCents),
                            }
                          : {}),
                      },
                    });
                  }}
                />
              </View>
            </View>
          </View>
        )}
      </BottomSheet>
    );
  },
);

ProviderSheet.displayName = "ProviderSheet";

const styles = StyleSheet.create((theme) => ({
  loading: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.4,
  },
  company: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 3,
  },
  role: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 3,
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
    marginTop: 14,
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
    justifyContent: "space-between",
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  serviceName: {
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 26,
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
