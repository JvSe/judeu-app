import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { providers } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { MapBackdrop } from "@/components/ui/map-backdrop";
import { ProviderMarker } from "@/components/ui/map-marker";
import { Screen } from "@/components/ui/screen";

const ROUTE_PATH = "M122,205 C122,300 235,300 262,375 C292,455 300,470 300,505";

export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = providers.find((item) => item.id === id) ?? providers[0];
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  return (
    <Screen>
      <MapBackdrop>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 402 874"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Path
            d={ROUTE_PATH}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={11}
            strokeLinecap="round"
            opacity={0.28}
          />
          <Path
            d={ROUTE_PATH}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </Svg>
        <ProviderMarker initials={provider.initials} color={provider.color} top={205} left={122} highlighted size={48} />
        <View style={styles.destinationPin}>
          <Ionicons name="home" size={17} color="#000052" />
        </View>
      </MapBackdrop>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </IconButton>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{provider.name.split(" ")[0]} está a caminho</Text>
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.etaText}>Chega em 8 min</Text>
          <Text style={styles.distanceText}>{provider.distanceKm} km</Text>
        </View>

        <View style={styles.progressRow}>
          <View style={[styles.progressDot, styles.progressDotDone]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
          <View style={[styles.progressBar, styles.progressBarDone]} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressDotPending} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelDone}>Aceito</Text>
          <Text style={styles.progressLabelActive}>A caminho</Text>
          <Text style={styles.progressLabelPending}>Chegou</Text>
        </View>

        <View style={styles.providerRow}>
          <Avatar initials={provider.initials} color={provider.color} size={52} radius={16} />
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerRole}>
              {provider.role} · ★ {provider.rating}
            </Text>
          </View>
          <IconButton
            variant="solid"
            size={48}
            onPress={() =>
              router.push({ pathname: "/client/chat/[id]", params: { id: provider.id } })
            }
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          </IconButton>
          <IconButton size={48}>
            <Ionicons name="call" size={19} color="#fff" />
          </IconButton>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  destinationPin: {
    position: "absolute",
    top: 505,
    left: 300,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -20 }, { translateY: -38 }, { rotate: "45deg" }],
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
    fontSize: 30,
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
  },
  progressDotDone: {
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: "rgba(255,102,0,0.3)",
  },
  progressDotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
