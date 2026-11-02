import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { forwardRef } from "react";
import { Pressable, Text, View } from "react-native";
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
  /** "open" = ajuda aberta (qualquer um perto pode pegar); "direct" = chamada feita para mim. */
  kind: "open" | "direct";
  /** Prestador aceita negociar valor (allowsNegotiation) — só para chamada direta. */
  canNegotiate: boolean;
  distanceKm: number | null;
  minutesAgo: number | null;
  accepting: boolean;
  rejecting: boolean;
  blockedLabel: string | null;
  onAccept: () => void;
  onReject: () => void;
  onPropose: () => void;
  onClose: () => void;
};

function memberSinceLabel(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  return month.replace(".", "");
}

type InfoRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

export const HelpSheet = forwardRef<BottomSheetMethods, HelpSheetProps>(
  (
    {
      order,
      kind,
      canNegotiate,
      distanceKm,
      minutesAgo,
      accepting,
      rejecting,
      blockedLabel,
      onAccept,
      onReject,
      onPropose,
      onClose,
    },
    ref,
  ) => {
    const direct = kind === "direct";
    const busy = accepting || rejecting;
    const insets = useSafeAreaInsets();
    const { theme } = useUnistyles();
    const place = order
      ? [order.address.neighborhood, order.address.city].filter(Boolean).join(" · ")
      : "";
    const when =
      minutesAgo == null ? null : minutesAgo < 1 ? "agora" : `há ${minutesAgo} min`;

    const ratingLabel =
      order && order.client.ratingCount > 0 && order.client.ratingAvg != null
        ? `${order.client.ratingAvg.toFixed(1)}`
        : null;
    const ratingCount = order?.client.ratingCount ?? 0;
    const since = order ? memberSinceLabel(order.client.createdAt) : "";
    const helpsCount = order?.client.completedOrders ?? 0;
    const cancelledCount = order?.client.cancelledOrders ?? 0;
    const totalOrders = order?.client.totalOrders ?? 0;
    const firstHelp = helpsCount === 0;
    const phoneVerified = !!order?.client.phoneVerified;
    const emailVerified = !!order?.client.emailVerified;
    const addressLine = order
      ? [order.address.neighborhood, order.address.city, order.address.state]
          .filter(Boolean)
          .join(" · ")
      : "";

    const infoRows: InfoRow[] = order
      ? [
          ...(addressLine
            ? [{ icon: "location-outline" as const, label: "Região", value: addressLine }]
            : []),
          ...(distanceKm != null
            ? [
                {
                  icon: "navigate-outline" as const,
                  label: "Distância",
                  value: `${distanceKm.toFixed(1)} km de você`,
                },
              ]
            : []),
          ...(since
            ? [
                {
                  icon: "person-outline" as const,
                  label: "Membro",
                  value: `Desde ${since}`,
                },
              ]
            : []),
          ...(order.category?.name
            ? [
                {
                  icon: "pricetag-outline" as const,
                  label: "Categoria",
                  value: order.category.name,
                },
              ]
            : []),
          {
            icon: "briefcase-outline",
            label: "Histórico",
            value:
              totalOrders === 0
                ? "Primeiro pedido na plataforma"
                : `${totalOrders} pedido${totalOrders === 1 ? "" : "s"} · ${cancelledCount} cancelado${cancelledCount === 1 ? "" : "s"}`,
          },
        ]
      : [];

    return (
      <BottomSheet
        ref={ref}
        snapPoints={["82%"]}
        backgroundColor={theme.colors.background}
        onClose={onClose}
        contentContainerStyle={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}
      >
        {!order ? (
          <View style={styles.empty} />
        ) : (
          <View style={styles.body}>
            <View style={styles.top}>
              <Text style={styles.earnLabel}>Você recebe</Text>
              <Text style={styles.earnValue}>{moneyFromCents(order.priceCents)}</Text>
              <Text style={styles.title} numberOfLines={3}>
                {direct
                  ? (order.service?.name ?? order.category?.name ?? order.description?.trim() ?? "Chamada")
                  : (order.description?.trim() || order.category?.name || "Ajuda")}
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
            </View>

            <View style={styles.personCard}>
              <View style={styles.personHeader}>
                <Avatar
                  initials={initialsOf(order.client.name)}
                  imageUri={order.client.avatarUrl}
                  size={72}
                  radius={22}
                />
                <View style={styles.personHeaderText}>
                  <Text style={styles.personEyebrow}>{direct ? "Quem te chamou" : "Quem pediu"}</Text>
                  <Text style={styles.personName} numberOfLines={2}>
                    {order.client.name}
                  </Text>
                  <View style={styles.badges}>
                    {firstHelp ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Primeira ajuda</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeMuted]}>
                        <Text style={styles.badgeText}>Já usou o Judeu</Text>
                      </View>
                    )}
                    {phoneVerified && (
                      <View style={[styles.badge, styles.badgeOk]}>
                        <Ionicons name="checkmark-circle" size={12} color="#7CFFB2" />
                        <Text style={[styles.badgeText, styles.badgeOkText]}>Tel. verificado</Text>
                      </View>
                    )}
                    {emailVerified && (
                      <View style={[styles.badge, styles.badgeOk]}>
                        <Ionicons name="checkmark-circle" size={12} color="#7CFFB2" />
                        <Text style={[styles.badgeText, styles.badgeOkText]}>E-mail ok</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.statGrid}>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>
                    {ratingLabel ? `${ratingLabel} ★` : "Novo"}
                  </Text>
                  <Text style={styles.statLabel}>
                    {ratingCount > 0
                      ? `${ratingCount} avaliaç${ratingCount === 1 ? "ão" : "ões"}`
                      : "Sem avaliações"}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{helpsCount}</Text>
                  <Text style={styles.statLabel}>
                    {helpsCount === 1 ? "ajuda concluída" : "ajudas concluídas"}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{cancelledCount}</Text>
                  <Text style={styles.statLabel}>
                    {cancelledCount === 1 ? "cancelamento" : "cancelamentos"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoList}>
                {infoRows.map((row) => (
                  <View key={row.label} style={styles.infoRow}>
                    <View style={styles.infoIcon}>
                      <Ionicons name={row.icon} size={15} color={theme.colors.primary} />
                    </View>
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <SpinButton
                controlled
                isActive={accepting}
                disabled={busy || !!blockedLabel}
                idleText={blockedLabel ?? (direct ? "Aceitar chamada" : "Atender esta ajuda")}
                activeText="Pegando..."
                onPress={onAccept}
                colors={{
                  idle: { background: theme.colors.primary, text: "#fff" },
                  active: { background: theme.colors.primary, text: "#fff" },
                }}
                buttonStyle={{ paddingVertical: 14, borderRadius: 16, fontSize: 16 }}
                spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
              />
              {direct && (
                <View style={styles.secondaryRow}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed || busy ? 0.7 : 1 }]}
                    onPress={onReject}
                    disabled={busy}
                  >
                    <Text style={[styles.secondaryBtnText, styles.secondaryBtnDanger]}>
                      {rejecting ? "Recusando..." : "Recusar"}
                    </Text>
                  </Pressable>
                  {canNegotiate && (
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed || busy ? 0.7 : 1 }]}
                      onPress={onPropose}
                      disabled={busy}
                    >
                      <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.secondaryBtnText}>Propor outro valor</Text>
                    </Pressable>
                  )}
                </View>
              )}
              <Text style={styles.hint}>
                {direct
                  ? "Essa pessoa chamou você. Se não puder atender, recuse para ela procurar outra."
                  : "Depois de atender, conversem no chat. A pessoa paga quando combinarem."}
              </Text>
            </View>
          </View>
        )}
      </BottomSheet>
    );
  },
);

HelpSheet.displayName = "HelpSheet";

const styles = StyleSheet.create((theme) => ({
  empty: { height: 80 },
  body: {
    flex: 1,
    gap: 12,
  },
  top: {
    gap: 8,
  },
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
    marginTop: 2,
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
  personCard: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: "rgba(28,28,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  personHeaderText: {
    flex: 1,
    gap: 4,
  },
  personEyebrow: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  personName: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    lineHeight: 26,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,102,0,0.18)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeMuted: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  badgeOk: {
    backgroundColor: "rgba(124,255,178,0.12)",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  badgeOkText: {
    color: "#7CFFB2",
  },
  statGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 16,
    backgroundColor: "rgba(20,20,44,0.55)",
    overflow: "hidden",
  },
  statCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 3,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statValue: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  statLabel: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  infoList: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(255,102,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
    lineHeight: 18,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  secondaryBtnDanger: {
    color: theme.colors.destructive,
  },
  footer: {
    marginTop: "auto",
    gap: 10,
  },
  hint: {
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
}));
