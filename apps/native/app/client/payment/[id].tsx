import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { providers } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/avatar";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Screen } from "@/components/ui/screen";

const SERVICE_FEE = 6;
const DISCOUNT = 8;

const paymentMethods = [
  { id: "pix", label: "Pix", icon: "flash" as const, tone: "success" as const },
  { id: "card", label: "Cartão de crédito", icon: "card-outline" as const, tone: "neutral" as const },
  { id: "cash", label: "Dinheiro", icon: "cash-outline" as const, tone: "neutral" as const },
];

export default function Payment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = providers.find((item) => item.id === id) ?? providers[0];
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const [method, setMethod] = useState("pix");

  const service = provider.services[0];
  const total = service.price + SERVICE_FEE - DISCOUNT;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Pagamento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Avatar initials={provider.initials} color={provider.color} size={50} radius={14} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>{service.name}</Text>
            <Text style={styles.summarySubtitle}>{provider.name} · Hoje, 14:30</Text>
          </View>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Serviço</Text>
            <Text style={styles.breakdownValue}>R$ {service.price.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Taxa de serviço</Text>
            <Text style={styles.breakdownValue}>R$ {SERVICE_FEE.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Cupom AJUDA10</Text>
            <Text style={styles.discountValue}>- R$ {DISCOUNT.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Forma de pagamento</Text>
        <View style={{ gap: 10 }}>
          {paymentMethods.map((option) => {
            const selected = option.id === method;
            return (
              <Pressable
                key={option.id}
                style={[styles.methodRow, selected && styles.methodRowSelected]}
                onPress={() => setMethod(option.id)}
              >
                <View
                  style={[
                    styles.methodIcon,
                    option.tone === "success" && styles.methodIconSuccess,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={option.tone === "success" ? theme.colors.success : "#fff"}
                  />
                </View>
                <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
                  {option.label}
                </Text>
                <View style={[styles.radio, selected && styles.radioSelected]} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <PrimaryButton
          label={`Confirmar e pagar R$ ${total.toFixed(2)}`}
          onPress={() =>
            router.replace({ pathname: "/client/tracking/[id]", params: { id: provider.id } })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  summarySubtitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  breakdownCard: {
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  breakdownLabel: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#9997bd",
  },
  breakdownValue: {
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  discountValue: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 13,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  totalValue: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
  },
  methodRowSelected: {
    backgroundColor: "rgba(255,102,0,0.1)",
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconSuccess: {
    backgroundColor: "rgba(49,208,127,0.16)",
  },
  methodLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#e8e8f5",
  },
  methodLabelSelected: {
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  radioSelected: {
    borderWidth: 6,
    borderColor: theme.colors.primary,
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
  },
}));
