import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import type { Payout, PayoutPreview, PixKeyType } from "@/lib/api";
import { moneyFromCents, shortDateTime } from "@/lib/format";
import {
  usePayoutOverview,
  usePayoutPreview,
  useRequestPayout,
  useSavePayoutAccount,
} from "@/lib/hooks";
import { PIX_KEY_TYPES, centsToInput, reaisToCents } from "@/lib/payout-format";
import { errorMessage, toast } from "@/lib/toast";

// Saque Pix. Enquanto o provedor real não é ligado (PAYOUT_PROVIDER=simulated),
// o saque é registrado e debitado da carteira, mas nenhum dinheiro é transferido.
export default function Withdraw() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: overview, isLoading } = usePayoutOverview();
  const [editingKey, setEditingKey] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [receipt, setReceipt] = useState<Payout | null>(null);
  const requestPayout = useRequestPayout();

  const amountCents = reaisToCents(amountText);
  const { data: livePreview, isFetching } = usePayoutPreview(amountCents);
  const preview: PayoutPreview | undefined = amountCents > 0 ? livePreview : undefined;

  // Começa sugerindo sacar tudo o que está disponível.
  useEffect(() => {
    if (overview && !amountText && overview.preview.availableCents > 0) {
      setAmountText(centsToInput(overview.preview.availableCents));
    }
  }, [overview, amountText]);

  if (isLoading || !overview) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const confirm = async () => {
    try {
      const payout = await requestPayout.mutateAsync(amountCents);
      setReceipt(payout);
      setAmountText("");
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível sacar agora."));
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </Pressable>
      <Text style={styles.headerTitle}>Sacar</Text>
    </View>
  );

  if (receipt) {
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.receipt}>
            <Ionicons name="checkmark-circle" size={44} color={theme.colors.success} />
            <Text style={styles.receiptTitle}>
              {receipt.simulated ? "Saque simulado registrado" : "Saque solicitado"}
            </Text>
            <Text style={styles.receiptValue}>{moneyFromCents(receipt.netCents)}</Text>
            <Text style={styles.muted}>para a chave {receipt.pixKeyMasked}</Text>
          </View>
          {receipt.simulated && <SimulationBanner />}
          <Breakdown
            rows={[
              ["Saldo antes", moneyFromCents(receipt.balanceBeforeCents)],
              ["Saque", `− ${moneyFromCents(receipt.amountCents)}`],
              ...(receipt.feeCents > 0
                ? ([["Tarifa", `− ${moneyFromCents(receipt.feeCents)}`]] as [string, string][])
                : []),
              ["Você recebe", moneyFromCents(receipt.netCents)],
            ]}
            total={["Saldo depois", moneyFromCents(receipt.balanceAfterCents)]}
          />
          <Text style={styles.muted}>Comprovante {receipt.providerRef ?? receipt.id.slice(0, 8)}</Text>
          <Pressable style={styles.primary} onPress={() => router.back()}>
            <Text style={styles.primaryText}>Voltar para Ganhos</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  const needsKey = !overview.account || editingKey;
  const canConfirm = !!preview && !preview.error && !isFetching && !requestPayout.isPending && !needsKey;

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {overview.simulated && <SimulationBanner />}

        <View style={styles.card}>
          <Text style={styles.label}>Disponível para saque</Text>
          <Text style={styles.big}>{moneyFromCents(overview.preview.availableCents)}</Text>
          {overview.preview.heldCents > 0 && (
            <Text style={styles.muted}>
              {moneyFromCents(overview.preview.heldCents)} retido por disputa em análise.
            </Text>
          )}
        </View>

        <Text style={styles.section}>Chave Pix</Text>
        {needsKey ? (
          <PixKeyForm
            onSaved={() => setEditingKey(false)}
            onCancel={overview.account ? () => setEditingKey(false) : undefined}
          />
        ) : (
          <View style={[styles.card, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{overview.account!.pixKeyMasked}</Text>
              <Text style={styles.muted}>{overview.account!.holderName}</Text>
            </View>
            <Pressable onPress={() => setEditingKey(true)} hitSlop={8}>
              <Text style={styles.link}>Trocar</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>Quanto sacar?</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>R$</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={theme.colors.mutedForeground}
          />
          <Pressable
            onPress={() => setAmountText(centsToInput(overview.preview.availableCents))}
            hitSlop={8}
          >
            <Text style={styles.link}>Tudo</Text>
          </Pressable>
        </View>

        {preview && (
          <>
            <Text style={styles.section}>Como fica depois do saque</Text>
            <Breakdown
              rows={[
                ["Saldo atual", moneyFromCents(preview.balanceCents)],
                ...(preview.heldCents > 0
                  ? ([["Retido por disputa", moneyFromCents(preview.heldCents)]] as [string, string][])
                  : []),
                ["Saque", `− ${moneyFromCents(preview.amountCents)}`],
                ...(preview.feeCents > 0
                  ? ([["Tarifa", `− ${moneyFromCents(preview.feeCents)}`]] as [string, string][])
                  : []),
                ["Você recebe no Pix", moneyFromCents(preview.netCents)],
              ]}
              total={["Saldo depois", moneyFromCents(preview.balanceAfterCents)]}
            />
            {preview.error && <Text style={styles.error}>{preview.error}</Text>}
          </>
        )}

        <Pressable
          style={[styles.primary, !canConfirm && { opacity: 0.5 }]}
          disabled={!canConfirm}
          onPress={() => void confirm()}
        >
          {requestPayout.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {overview.simulated ? "Simular saque" : "Confirmar saque"}
            </Text>
          )}
        </Pressable>

        {overview.payouts.length > 0 && (
          <>
            <Text style={styles.section}>Saques anteriores</Text>
            {overview.payouts.map((p) => (
              <View key={p.id} style={[styles.card, styles.row]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{moneyFromCents(p.netCents)}</Text>
                  <Text style={styles.muted}>
                    {shortDateTime(p.createdAt)} · {p.pixKeyMasked}
                  </Text>
                </View>
                <Text style={styles.status}>{STATUS_LABEL[p.status]}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const STATUS_LABEL: Record<Payout["status"], string> = {
  SIMULATED: "Simulado",
  PROCESSING: "Em processamento",
  PAID: "Pago",
  FAILED: "Falhou",
};

function SimulationBanner() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.banner}>
      <Ionicons name="flask-outline" size={18} color={theme.colors.primary} />
      <Text style={styles.bannerText}>
        Modo simulação: o saque é registrado e sai do seu saldo no app, mas nenhum dinheiro é
        transferido ainda.
      </Text>
    </View>
  );
}

function Breakdown({ rows, total }: { rows: [string, string][]; total: [string, string] }) {
  return (
    <View style={styles.card}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.breakRow}>
          <Text style={styles.breakLabel}>{label}</Text>
          <Text style={styles.breakValue}>{value}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.breakRow}>
        <Text style={styles.totalLabel}>{total[0]}</Text>
        <Text style={styles.totalValue}>{total[1]}</Text>
      </View>
    </View>
  );
}

function PixKeyForm({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const { theme } = useUnistyles();
  const save = useSavePayoutAccount();
  const [type, setType] = useState<PixKeyType>("CPF");
  const [key, setKey] = useState("");
  const [holder, setHolder] = useState("");
  const option = PIX_KEY_TYPES.find((o) => o.value === type)!;

  const submit = async () => {
    try {
      await save.mutateAsync({ pixKeyType: type, pixKey: key, holderName: holder });
      toast.success("Chave Pix salva");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível salvar a chave."));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.chips}>
        {PIX_KEY_TYPES.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => setType(o.value)}
            style={[styles.chip, type === o.value && styles.chipOn]}
          >
            <Text style={[styles.chipText, type === o.value && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={key}
        onChangeText={setKey}
        placeholder={option.placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        autoCapitalize="none"
        keyboardType={type === "CPF" || type === "CNPJ" || type === "PHONE" ? "number-pad" : "default"}
      />
      <TextInput
        style={styles.input}
        value={holder}
        onChangeText={setHolder}
        placeholder="Nome do titular da conta"
        placeholderTextColor={theme.colors.mutedForeground}
        autoCapitalize="words"
      />
      <View style={styles.row}>
        {onCancel && (
          <Pressable onPress={onCancel} hitSlop={8} style={{ marginRight: 16 }}>
            <Text style={styles.linkMuted}>Cancelar</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.secondary, (save.isPending || !key.trim() || holder.trim().length < 3) && { opacity: 0.5 }]}
          disabled={save.isPending || !key.trim() || holder.trim().length < 3}
          onPress={() => void submit()}
        >
          <Text style={styles.secondaryText}>{save.isPending ? "Salvando..." : "Salvar chave"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.extraBold, color: "#fff" },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 10 },
  card: { backgroundColor: "rgba(28,28,58,0.92)", borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  big: { fontSize: 30, fontFamily: fonts.extraBold, color: "#fff" },
  section: { marginTop: 12, fontSize: 13, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
  muted: { fontSize: 13, fontFamily: fonts.medium, color: theme.colors.mutedForeground },
  link: { fontSize: 14, fontFamily: fonts.bold, color: theme.colors.primary },
  linkMuted: { fontSize: 14, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.92)",
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  currency: { fontSize: 22, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 26, fontFamily: fonts.extraBold, color: "#fff" },
  breakRow: { flexDirection: "row", justifyContent: "space-between" },
  breakLabel: { fontSize: 14, fontFamily: fonts.medium, color: theme.colors.mutedForeground },
  breakValue: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 },
  totalLabel: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
  totalValue: { fontSize: 17, fontFamily: fonts.extraBold, color: theme.colors.primary },
  error: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.destructive },
  primary: {
    marginTop: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { fontSize: 16, fontFamily: fonts.bold, color: "#fff" },
  secondary: {
    marginLeft: "auto",
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryText: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
  status: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  banner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(255,102,0,0.08)",
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: "#fff", lineHeight: 19 },
  receipt: { alignItems: "center", gap: 6, paddingVertical: 20 },
  receiptTitle: { fontSize: 18, fontFamily: fonts.bold, color: "#fff" },
  receiptValue: { fontSize: 34, fontFamily: fonts.extraBold, color: "#fff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipOn: { borderColor: theme.colors.primary, backgroundColor: "rgba(255,102,0,0.12)" },
  chipText: { fontSize: 13, fontFamily: fonts.semiBold, color: theme.colors.mutedForeground },
  chipTextOn: { color: theme.colors.primary },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#fff",
    backgroundColor: "rgba(15,15,38,0.9)",
  },
}));
