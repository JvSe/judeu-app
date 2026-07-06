import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
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
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <LinearGradient colors={["#FF6600", "#d94f00"]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <IconButton onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </IconButton>
          <IconButton>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </IconButton>
        </View>
        <LinearGradient
          colors={["transparent", theme.colors.background]}
          style={styles.heroFade}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
        <Text style={styles.role}>{provider.role}</Text>

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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View>
          <Text style={styles.footerLabel}>A partir de</Text>
          <Text style={styles.footerPrice}>{priceFromCents(provider.priceFromCents)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Contratar agora"
            onPress={() => {
              const cheapest = provider.services[0];
              router.push({
                pathname: "/client/create-order",
                params: {
                  providerId: provider.id,
                  providerName: provider.name,
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
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    height: 220,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  role: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 4,
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
