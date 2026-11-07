import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePaymentSheet } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";
import { fonts } from "@/constants/fonts";
import type { Order, Payment, PaymentMethodOption, PixDisplay } from "@/lib/api";
import { moneyFromCents } from "@/lib/format";
import {
  useConfirmPayment,
  useCreatePayment,
  useOrder,
  useOrderPayment,
} from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

const paymentMethods: {
  id: PaymentMethodOption;
  label: string;
  icon: "flash" | "card-outline" | "cash-outline";
  tone: "success" | "neutral";
}[] = [
  { id: "PIX", label: "Pix", icon: "flash", tone: "success" },
  { id: "CARD", label: "Cartão de crédito", icon: "card-outline", tone: "neutral" },
  { id: "CASH", label: "Dinheiro no local", icon: "cash-outline", tone: "neutral" },
];

function isPaymentSettled(
  payment: Payment | null | undefined,
  orderPayment: { status: string; method: string } | null | undefined,
): boolean {
  if (payment?.status === "PAID" || orderPayment?.status === "PAID") return true;
  if (payment?.method === "CASH" || orderPayment?.method === "CASH") return true;
  return false;
}

export default function Payment() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [method, setMethod] = useState<PaymentMethodOption>("PIX");
  const [pix, setPix] = useState<PixDisplay | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const redirectedRef = useRef(false);

  const { data: order, isLoading } = useOrder(id, { poll: true });
  const { data: payment } = useOrderPayment(id);
  const createPayment = useCreatePayment();
  const confirmPayment = useConfirmPayment();

  const paymentDone = isPaymentSettled(payment, order?.payment ?? null);

  const goToDetails = () => {
    if (!id || redirectedRef.current) return;
    redirectedRef.current = true;
    // Href em string é o caminho mais estável no Expo Router.
    const href = `/client/order/${id}`;
    setTimeout(() => {
      router.replace(href as never);
    }, 0);
  };

  const markOrderPaidLocally = (paid: Payment) => {
    const snapshot = { status: paid.status, method: paid.method } as Order["payment"];
    queryClient.setQueryData(["payment", id], paid);
    queryClient.setQueryData<Order>(["order", id], (current) =>
      current ? { ...current, payment: snapshot } : current,
    );
    queryClient.setQueryData<Order[]>(["orders", "client"], (list) =>
      list?.map((item) => (item.id === id ? { ...item, payment: snapshot } : item)),
    );
    queryClient.setQueryData<Order[]>(["orders", "provider"], (list) =>
      list?.map((item) => (item.id === id ? { ...item, payment: snapshot } : item)),
    );
  };

  /** POST /payment/confirm força sync com Stripe até PAID (ou esgota tentativas). */
  const waitUntilSettled = async (): Promise<Payment | null> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const confirmed = await confirmPayment.mutateAsync(order!.id);
        if (isPaymentSettled(confirmed, null)) return confirmed;
      } catch (err) {
        lastError = err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (lastError) throw lastError;
    return null;
  };

  // Entrada com pedido já pago / confirmação via poll (Pix).
  useEffect(() => {
    if (!order || isLoading || !paymentDone) return;
    goToDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDone, order?.id, isLoading]);

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (paymentDone || redirectedRef.current) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.mutedForeground, fontFamily: fonts.medium }}>
            Pagamento ok — abrindo detalhes…
          </Text>
        </View>
      </Screen>
    );
  }

  const handleConfirm = async () => {
    setErrorMsg(null);
    setConfirming(true);
    try {
      const result = await createPayment.mutateAsync({ orderId: order.id, method });

      // Já estava pago (idempotente no backend) — só redireciona.
      if (isPaymentSettled(result.payment, null)) {
        markOrderPaidLocally(result.payment);
        toast.success("Pagamento confirmado");
        goToDetails();
        return;
      }

      if (method === "CASH") {
        markOrderPaidLocally(result.payment);
        toast.success("Pagamento em dinheiro confirmado");
        goToDetails();
        return;
      }

      if (method === "PIX") {
        setPix(result.pix ?? null);
        toast.info("Pix gerado", { description: "Fique nesta tela até a confirmação." });
        return;
      }

      // CARD
      if (!result.clientSecret) {
        const message = "Não foi possível iniciar o pagamento.";
        setErrorMsg(message);
        toast.error(message);
        return;
      }
      const init = await initPaymentSheet({
        merchantDisplayName: "Judeu",
        paymentIntentClientSecret: result.clientSecret,
      });
      if (init.error) {
        setErrorMsg(init.error.message);
        toast.error(init.error.message);
        return;
      }
      const present = await presentPaymentSheet();
      if (present.error) {
        setErrorMsg(present.error.message);
        toast.error(present.error.message);
        return;
      }

      const settled = await waitUntilSettled();
      if (!settled || !isPaymentSettled(settled, null)) {
        const message =
          "O cartão foi autorizado, mas a confirmação ainda não chegou. Não pague de novo — abra o pedido em alguns segundos.";
        setErrorMsg(message);
        toast.info("Confirmando pagamento…", {
          description: "Não tente pagar de novo; estamos sincronizando.",
        });
        return;
      }
      markOrderPaidLocally(settled);
      toast.success("Pagamento confirmado");
      goToDetails();
    } catch (e) {
      const message = errorMessage(e, "Não foi possível processar o pagamento.");
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pix) return;
    await Clipboard.setStringAsync(pix.data);
    setCopied(true);
    toast.success("Código Pix copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const busy = confirming || createPayment.isPending;

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
          {order.feePayer === "CLIENT" && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Taxa da plataforma</Text>
              <Text style={styles.breakdownValue}>{moneyFromCents(order.platformFeeCents)}</Text>
            </View>
          )}
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
                    disabled={busy}
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
          </>
        )}

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </ScrollView>

      {!pix && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <SpinButton
            controlled
            isActive={busy}
            disabled={busy}
            idleText={
              method === "CASH"
                ? "Confirmar pagamento em dinheiro"
                : `Confirmar e pagar ${moneyFromCents(order.totalCents)}`
            }
            activeText="Processando..."
            onPress={() => void handleConfirm()}
            colors={{
              idle: { background: theme.colors.primary, text: "#fff" },
              active: { background: theme.colors.primary, text: "#fff" },
            }}
            buttonStyle={{ paddingVertical: 15, borderRadius: 16, fontSize: 15 }}
            spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
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
