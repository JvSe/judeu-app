import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { forwardRef } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import type { Order } from "@/lib/api";
import { initialsOf, moneyFromCents } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import SpinButton from "@/components/ui/spin-button";
import { BottomSheet } from "@/components/ui/templates/bottom-sheet";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";

type HelpSheetProps = {
  order: Order | null;
  distanceKm: number | null;
  minutesAgo: number | null;
  accepting: boolean;
  blockedLabel: string | null;
  onAccept: () => void;
  onClose: () => void;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Alguém";
}

export const HelpSheet = forwardRef<BottomSheetMethods, HelpSheetProps>(
  ({ order, distanceKm, minutesAgo, accepting, blockedLabel, onAccept, onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const { theme } = useUnistyles();
    const place = order
      ? [order.address.neighborhood, order.address.city].filter(Boolean).join(" · ")
      : "";
    const when =
      minutesAgo == null ? null : minutesAgo < 1 ? "agora" : `há ${minutesAgo} min`;

    return (
      <BottomSheet
        ref={ref}
        snapPoints={["58%"]}
        backgroundColor={theme.colors.background}
        onClose={onClose}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}
      >
        {!order ? (
          <View style={styles.empty} />
        ) : (
          <View style={styles.body}>
            <Text style={styles.earnLabel}>Você recebe</Text>
            <Text style={styles.earnValue}>{moneyFromCents(order.priceCents)}</Text>
            <Text style={styles.title} numberOfLines={3}>
              {order.description?.trim() || order.category?.name || "Ajuda"}
            </Text>

            <View style={styles.chips}>
              {distanceKm != null && (
                <View style={styles.chip}>
                  <Ionicons name="navigate" size={13} color={theme.colors.primary} />
                  <Text style={styles.chipText}>{distanceKm.toFixed(1)} km</Text>
                </View>
              )}
              {when && (
                <View style={styles.chip}>
                  <Ionicons name="time-outline" size={13} color={theme.colors.primary} />
                  <Text style={styles.chipText}>{when}</Text>
                </View>
              )}
              {place ? (
                <View style={styles.chip}>
                  <Ionicons name="location" size={13} color={theme.colors.primary} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.person}>
              <Avatar initials={initialsOf(order.client.name)} size={36} radius={12} />
              <Text style={styles.personName}>{firstName(order.client.name)} pediu</Text>
            </View>

            <SpinButton
              controlled
              isActive={accepting}
              disabled={accepting || !!blockedLabel}
              idleText={blockedLabel ?? "Atender esta ajuda"}
              activeText="Pegando..."
              onPress={onAccept}
              colors={{
                idle: { background: theme.colors.primary, text: "#fff" },
                active: { background: theme.colors.primary, text: "#fff" },
              }}
              buttonStyle={{ paddingVertical: 14, borderRadius: 16, fontSize: 16 }}
              spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
            />
            <Text style={styles.hint}>A pessoa paga primeiro. Aí você inicia o caminho.</Text>
          </View>
        )}
      </BottomSheet>
    );
  },
);

HelpSheet.displayName = "HelpSheet";

const styles = StyleSheet.create((theme) => ({
  empty: { height: 80 },
  body: { gap: 10 },
  earnLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  earnValue: {
    fontSize: 34,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    letterSpacing: -1,
    marginTop: -6,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    lineHeight: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,102,0,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
    marginBottom: 6,
  },
  personName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  hint: {
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
}));
