import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaymentSheet } from "@stripe/stripe-react-native";

import { fonts } from "@/constants/fonts";
import { moneyFromCents } from "@/lib/format";
import { useCreatePayment, useOrder, useOrderPayment } from "@/lib/hooks";
import type { PaymentMethodOption, PixDisplay } from "@/lib/api";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Screen } from "@/components/ui/screen";

const paymentMethods: { id: PaymentMethodOption; label: string; icon: "flash" | "card-outline" | "cash-outline"; tone: "success" | "neutral" }[] = [
  { id: "PIX", label: "Pix", icon: "flash", tone: "success" },
  { id: "CARD", label: "Cartão de crédito", icon: "card-outline", tone: "neutral" },
  { id: "CASH", label: "Dinheiro", icon: "cash-outline", tone: "neutral" },
];

export default function Payment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [method, setMethod] = useState<PaymentMethodOption>("PIX");
  const [pix, setPix] = useState<PixDisplay | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: order, isLoading } = useOrder(id);
  const { data: payment } = useOrderPayment(id);
  const createPayment = useCreatePayment();

  const goToOrder = () => router.replace({ pathname: "/client/order/[id]", params: { id } });

  useEffect(() => {
    if (payment?.status === "PAID") goToOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.status]);

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const handleConfirm = async () => {
    setErrorMsg(null);
    try {
      const result = await createPayment.mutateAsync({ orderId: order.id, method });

      if (method === "CASH") {
        goToOrder();
        return;
      }

      if (method === "PIX") {
        setPix(result.pix ?? null);
        return;
      }

      // CARD
      if (!result.clientSecret) {
        setErrorMsg("Não foi possível iniciar o pagamento.");
        return;
      }
      const init = await initPaymentSheet({
        merchantDisplayName: "Ajuda+",
        paymentIntentClientSecret: result.clientSecret,
      });
      if (init.error) {
        setErrorMsg(init.error.message);
        return;
      }
      const present = await presentPaymentSheet();
      if (present.error) {
        setErrorMsg(present.error.message);
        return;
      }
      goToOrder();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível processar o pagamento.");
    }
  };

  const handleCopyPix = async () => {
    if (!pix) return;
    await Clipboard.setStringAsync(pix.data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Pagamento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Serviço</Text>
            <Text style={styles.breakdownValue}>{moneyFromCents(order.priceCents)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Taxa da plataforma</Text>
            <Text style={styles.breakdownValue}>{moneyFromCents(order.platformFeeCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{moneyFromCents(order.totalCents)}</Text>
          </View>
        </View>

        {pix ? (
          <View style={styles.pixCard}>
            {pix.imageUrl && (
              <Image source={{ uri: pix.imageUrl }} style={styles.pixQr} resizeMode="contain" />
            )}
            <Text style={styles.pixHint}>Escaneie o QR code ou copie o código abaixo</Text>
            <Pressable style={styles.pixCopyButton} onPress={handleCopyPix}>
              <Text style={styles.pixCopyText} numberOfLines={1}>
                {copied ? "Copiado!" : pix.data}
              </Text>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color="#fff" />
            </Pressable>
            <View style={styles.pixWaitingRow}>
              <ActivityIndicator color={theme.colors.primary} size="small" />
              <Text style={styles.pixWaitingText}>Aguardando confirmação do pagamento…</Text>
            </View>
          </View>
        ) : (
          <>
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
                      style={[styles.methodIcon, option.tone === "success" && styles.methodIconSuccess]}
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
          </>
        )}

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </ScrollView>

      {!pix && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <PrimaryButton
            label={
              createPayment.isPending
                ? "Processando…"
                : `Confirmar e pagar ${moneyFromCents(order.totalCents)}`
            }
            onPress={createPayment.isPending ? undefined : handleConfirm}
          />
        </View>
      )}
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
  pixCard: {
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 14,
  },
  pixQr: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  pixHint: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  pixCopyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  pixCopyText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
  },
  pixWaitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  pixWaitingText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  errorText: {
    marginTop: 14,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
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
