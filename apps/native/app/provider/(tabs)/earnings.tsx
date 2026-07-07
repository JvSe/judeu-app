import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { moneyFromCents, shortDateTime } from "@/lib/format";
import { useWallet } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

export default function ProviderEarnings() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: wallet, isLoading } = useWallet();

  if (isLoading || !wallet) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const maxDayCents = Math.max(...wallet.daily.map((d) => d.totalCents), 1);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 6 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Ganhos</Text>
          <View style={styles.periodChip}>
            <Text style={styles.periodText}>Esta semana</Text>
            <Ionicons name="chevron-down" size={13} color={theme.colors.mutedForeground} />
          </View>
        </View>

        <LinearGradient colors={["#FF6600", "#d94f00"]} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo disponível</Text>
          <Text style={styles.balanceValue}>{moneyFromCents(wallet.balanceCents)}</Text>
          <View style={styles.balanceActions}>
            <View style={styles.withdrawButton}>
              <Text style={styles.withdrawText}>Sacar</Text>
            </View>
            <View style={styles.statementButton}>
              <Text style={styles.statementText}>Extrato</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Ganhos por dia</Text>
            <Text style={styles.chartTotal}>Total {moneyFromCents(wallet.weekTotalCents)}</Text>
          </View>
          <View style={styles.chart}>
            {wallet.daily.map((bar, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(bar.totalCents / maxDayCents) * 100}%` },
                      bar.isToday && styles.barHighlighted,
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, bar.isToday && styles.barLabelHighlighted]}>
                  {bar.day[0]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Últimos recebimentos</Text>
        {wallet.transactions.length === 0 && (
          <Text style={styles.emptyText}>Nenhuma movimentação ainda.</Text>
        )}
        {wallet.transactions.map((entry) => {
          const isIn = entry.type === "CREDIT";
          return (
            <View key={entry.id} style={styles.historyRow}>
              <View style={[styles.historyIcon, isIn ? styles.historyIconIn : styles.historyIconOut]}>
                <Ionicons
                  name={isIn ? "arrow-up" : "arrow-down"}
                  size={19}
                  color={isIn ? theme.colors.success : theme.colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{entry.description ?? "Movimentação"}</Text>
                <Text style={styles.historyMeta}>{shortDateTime(entry.createdAt)}</Text>
              </View>
              <Text style={[styles.historyAmount, isIn ? styles.amountIn : styles.amountOut]}>
                {isIn ? "+" : "-"} {moneyFromCents(entry.amountCents)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heading: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  periodText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#c9c7e4",
  },
  balanceCard: {
    borderRadius: 26,
    padding: 22,
    shadowColor: "#FF6600",
    shadowOpacity: 0.35,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.semiBold,
  },
  balanceValue: {
    fontSize: 42,
    fontFamily: fonts.extraBold,
    color: "#fff",
    letterSpacing: -1,
    marginTop: 2,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 11,
    marginTop: 18,
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 14,
  },
  withdrawText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: "#d94f00",
  },
  statementButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
  },
  statementText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  chartCard: {
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    padding: 18,
    marginTop: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  chartTotal: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 110,
    gap: 9,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "100%",
    flex: 1,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    backgroundColor: "rgba(255,102,0,0.35)",
    borderRadius: 7,
  },
  barHighlighted: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  barLabelHighlighted: {
    color: theme.colors.primary,
    fontFamily: fonts.extraBold,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 24,
    marginBottom: 13,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  historyIconIn: {
    backgroundColor: "rgba(49,208,127,0.16)",
  },
  historyIconOut: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  historyTitle: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  historyMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  historyAmount: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  amountIn: {
    color: theme.colors.success,
  },
  amountOut: {
    color: "#c9c7e4",
  },
}));
