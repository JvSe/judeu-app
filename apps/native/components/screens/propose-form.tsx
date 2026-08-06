import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { moneyFromCents } from "@/lib/format";
import { useCreateProposal, useOrder, useOrderProposals, useRespondToProposal } from "@/lib/hooks";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";

const ROLE_LABELS: Record<"client" | "provider", { counterpart: string; counterpartLower: string }> = {
  client: { counterpart: "Prestador", counterpartLower: "prestador" },
  provider: { counterpart: "Cliente", counterpartLower: "cliente" },
};

const proposeSchema = z.object({
  price: z.string().transform((v, ctx) => {
    const cents = Math.round(Number(v.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
      return z.NEVER;
    }
    return cents;
  }),
  note: z.string(),
});

type ProposeFormInput = z.input<typeof proposeSchema>;
type ProposeFormOutput = z.output<typeof proposeSchema>;

// Orçamento/negociação antes do aceite (RF-D5) — compartilhado entre cliente e
// prestador, que propõem um novo valor ou respondem a uma contraproposta enquanto
// o pedido segue CREATED. `role` decide de qual lado a tela está sendo vista.
export function ProposeForm({ role }: { role: "client" | "provider" }) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading: loadingOrder } = useOrder(id, { poll: true });
  const { data: proposals = [], isLoading: loadingProposals } = useOrderProposals(id);
  const createProposal = useCreateProposal();
  const respondToProposal = useRespondToProposal();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [respondAction, setRespondAction] = useState<"accept" | "reject" | null>(null);

  const { control, handleSubmit, reset } = useForm<ProposeFormInput, unknown, ProposeFormOutput>({
    resolver: zodResolver(proposeSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { price: "", note: "" },
  });

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
  const { counterpart, counterpartLower } = ROLE_LABELS[role];
  const counterpartName = role === "client" ? (order.provider?.name ?? "—") : order.client.name;

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await createProposal.mutateAsync({
        orderId: order.id,
        input: { priceCents: data.price, note: data.note.trim() || undefined },
      });
      reset({ price: "", note: "" });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar a proposta.");
    }
  });

  const handleRespond = async (action: "accept" | "reject") => {
    if (!pending) return;
    setSubmitError(null);
    setRespondAction(action);
    try {
      await respondToProposal.mutateAsync({ orderId: order.id, proposalId: pending.id, action });
      if (action === "accept") router.back();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível responder à proposta.");
    } finally {
      setRespondAction(null);
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
          <Text style={styles.currentClient}>
            {counterpart}: {counterpartName}
          </Text>
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

        {pending && pending.byRole !== role && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>O {counterpartLower} propôs um novo valor</Text>
            <Text style={styles.pendingValue}>{moneyFromCents(pending.priceCents)}</Text>
            {pending.note && <Text style={styles.pendingNote}>“{pending.note}”</Text>}
            <View style={styles.pendingActions}>
              <SpinButton
                controlled
                isActive={respondAction === "reject" && respondToProposal.isPending}
                disabled={respondToProposal.isPending}
                idleText="Recusar"
                activeText="Recusando..."
                onPress={() => handleRespond("reject")}
                colors={{
                  idle: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                  active: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                }}
                buttonStyle={{ paddingHorizontal: 20, paddingVertical: 13, borderRadius: 13, fontSize: 13.5 }}
                spinnerConfig={{ color: theme.colors.mutedForeground, containerBackground: "rgba(255,255,255,0.06)" }}
              />
              <View style={{ flex: 1 }}>
                <SpinButton
                  controlled
                  isActive={respondAction === "accept" && respondToProposal.isPending}
                  disabled={respondToProposal.isPending}
                  idleText={`Aceitar ${moneyFromCents(pending.priceCents)}`}
                  activeText="Aceitando..."
                  onPress={() => handleRespond("accept")}
                  colors={{
                    idle: { background: theme.colors.primary, text: "#fff" },
                    active: { background: theme.colors.primary, text: "#fff" },
                  }}
                  buttonStyle={{ paddingHorizontal: 20, paddingVertical: 13, borderRadius: 13, fontSize: 13.5 }}
                  spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        )}

        {pending && pending.byRole === role && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>Sua proposta</Text>
            <Text style={styles.pendingValue}>{moneyFromCents(pending.priceCents)}</Text>
            <Text style={styles.waitingText}>Aguardando resposta do {counterpartLower}…</Text>
          </View>
        )}

        {canNegotiate && !pending && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Propor um valor diferente</Text>
            <FormInput
              control={control}
              name="price"
              prefix="R$"
              placeholder="0,00"
              keyboardType="decimal-pad"
              containerStyle={styles.priceSpacing}
            />
            <FormInput
              control={control}
              name="note"
              placeholder="Explique o motivo (opcional)…"
              multiline
              containerStyle={styles.noteSpacing}
              boxStyle={styles.noteBox}
              inputStyle={styles.noteInput}
            />
            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { opacity: pressed || createProposal.isPending ? 0.9 : 1 },
              ]}
              onPress={onValid}
              disabled={createProposal.isPending}
            >
              <Text style={styles.submitText}>
                {createProposal.isPending ? "Enviando..." : "Enviar proposta"}
              </Text>
            </Pressable>
          </View>
        )}

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Histórico</Text>
            {history.map((p) => (
              <View key={p.id} style={styles.historyRow}>
                <Text style={styles.historyRole}>{p.byRole === role ? "Você" : counterpart}</Text>
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
  priceSpacing: {
    marginBottom: 12,
  },
  noteSpacing: {
    marginBottom: 16,
  },
  noteBox: {
    backgroundColor: "rgba(20,20,44,0.8)",
    borderColor: theme.colors.border,
    borderRadius: 15,
    padding: 13,
  },
  noteInput: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    minHeight: 60,
    lineHeight: undefined,
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
  submitError: {
    textAlign: "center",
    marginBottom: 16,
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
