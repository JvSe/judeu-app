import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { moneyFromCents } from "@/lib/format";
import { useCreateProposal, useOrder, useOrderProposals, useRespondToProposal } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

// Orçamento/negociação antes do aceite (RF-D5), lado cliente: propõe um novo
// valor ou responde a uma contraproposta do prestador, enquanto o pedido segue CREATED.
export default function ClientPropose() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading: loadingOrder } = useOrder(id, { poll: true });
  const { data: proposals = [], isLoading: loadingProposals } = useOrderProposals(id);
  const createProposal = useCreateProposal();
  const respondToProposal = useRespondToProposal();

  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (loadingOrder || loadingProposals || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const pending = proposals.find((p) => p.status === "PENDING");
  const canNegotiate = order.status === "CREATED";
  const history = proposals.filter((p) => p.id !== pending?.id);

  const handleSend = async () => {
    setErrorMsg(null);
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      setErrorMsg("Informe um valor válido.");
      return;
    }
    try {
      await createProposal.mutateAsync({
        orderId: order.id,
        input: { priceCents, note: note.trim() || undefined },
      });
      setPrice("");
      setNote("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível enviar a proposta.");
    }
  };

  const handleRespond = async (action: "accept" | "reject") => {
    if (!pending) return;
    setErrorMsg(null);
    try {
      await respondToProposal.mutateAsync({ orderId: order.id, proposalId: pending.id, action });
      if (action === "accept") router.back();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível responder à proposta.");
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Orçamento do pedido</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Valor atual</Text>
          <Text style={styles.currentValue}>{moneyFromCents(order.priceCents)}</Text>
          <Text style={styles.currentClient}>Prestador: {order.provider?.name ?? "—"}</Text>
        </View>

        {!canNegotiate && (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle" size={18} color={theme.colors.mutedForeground} />
            <Text style={styles.noticeText}>
              Este pedido já saiu do estágio de negociação (status atual:{" "}
              {order.status === "CANCELLED" ? "cancelado" : "aceito ou em andamento"}).
            </Text>
          </View>
        )}

        {pending && pending.byRole === "provider" && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>O prestador propôs um novo valor</Text>
            <Text style={styles.pendingValue}>{moneyFromCents(pending.priceCents)}</Text>
            {pending.note && <Text style={styles.pendingNote}>“{pending.note}”</Text>}
            <View style={styles.pendingActions}>
              <Pressable
                style={styles.declineButton}
                onPress={() => handleRespond("reject")}
                disabled={respondToProposal.isPending}
              >
                <Text style={styles.declineText}>Recusar</Text>
              </Pressable>
              <Pressable
                style={styles.acceptButton}
                onPress={() => handleRespond("accept")}
                disabled={respondToProposal.isPending}
              >
                <Text style={styles.acceptText}>Aceitar {moneyFromCents(pending.priceCents)}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {pending && pending.byRole === "client" && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>Sua proposta</Text>
            <Text style={styles.pendingValue}>{moneyFromCents(pending.priceCents)}</Text>
            <Text style={styles.waitingText}>Aguardando resposta do prestador…</Text>
          </View>
        )}

        {canNegotiate && !pending && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Propor um valor diferente</Text>
            <View style={styles.priceRow}>
              <Text style={styles.pricePrefix}>R$</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0,00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.colors.mutedForeground}
                style={styles.priceInput}
              />
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Explique o motivo (opcional)…"
              placeholderTextColor={theme.colors.mutedForeground}
              multiline
              style={styles.noteInput}
            />
            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { opacity: pressed || createProposal.isPending ? 0.9 : 1 },
              ]}
              onPress={handleSend}
              disabled={createProposal.isPending}
            >
              <Text style={styles.submitText}>
                {createProposal.isPending ? "Enviando..." : "Enviar proposta"}
              </Text>
            </Pressable>
          </View>
        )}

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Histórico</Text>
            {history.map((p) => (
              <View key={p.id} style={styles.historyRow}>
                <Text style={styles.historyRole}>
                  {p.byRole === "client" ? "Você" : "Prestador"}
                </Text>
                <Text style={styles.historyValue}>{moneyFromCents(p.priceCents)}</Text>
                <Text style={styles.historyStatus}>
                  {p.status === "ACCEPTED"
                    ? "Aceita"
                    : p.status === "REJECTED"
                      ? "Recusada"
                      : "Substituída"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 60,
  },
  currentCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  currentValue: {
    fontSize: 30,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 2,
  },
  currentClient: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 6,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 18,
  },
  pendingCard: {
    backgroundColor: "rgba(255,102,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  pendingLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#FF9a52",
  },
  pendingValue: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 4,
  },
  pendingNote: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    marginTop: 8,
    lineHeight: 18,
  },
  waitingText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 8,
  },
  pendingActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  declineButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 13,
  },
  declineText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 13,
  },
  acceptText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  formCard: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 14.5,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,44,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  pricePrefix: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
    paddingVertical: 13,
  },
  noteInput: {
    backgroundColor: "rgba(20,20,44,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    padding: 13,
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: "#fff",
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  errorText: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
  },
  historyCard: {
    backgroundColor: "rgba(28,28,58,0.5)",
    borderRadius: 18,
    padding: 16,
  },
  historyTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  historyRole: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
    flex: 1,
  },
  historyValue: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  historyStatus: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    minWidth: 70,
    textAlign: "right",
  },
}));
