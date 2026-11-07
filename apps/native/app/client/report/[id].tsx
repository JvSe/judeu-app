import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { ordersApi, type ReportReason } from "@/lib/api";
import { errorMessage, toast } from "@/lib/toast";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "SAFETY", label: "Me senti em risco" },
  { value: "BEHAVIOR", label: "Comportamento inadequado" },
  { value: "FRAUD", label: "Golpe ou cobrança indevida" },
  { value: "NO_SHOW", label: "Não apareceu" },
  { value: "OTHER", label: "Outro motivo" },
];

// Denúncia da outra parte do pedido. A equipe revisa e pode suspender a conta.
export default function ReportScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await ordersApi.report(id, reason, details.trim() || undefined);
      toast.success("Denúncia enviada", { description: "Nossa equipe vai analisar." });
      router.back();
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível enviar a denúncia."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Denunciar</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.text}>
          Se você está em perigo agora, ligue 190. A denúncia é confidencial: a outra pessoa não vê
          quem denunciou.
        </Text>
        {REASONS.map((r) => (
          <Pressable
            key={r.value}
            onPress={() => setReason(r.value)}
            style={[styles.option, reason === r.value && styles.optionOn]}
          >
            <Text style={[styles.optionText, reason === r.value && styles.optionTextOn]}>{r.label}</Text>
          </Pressable>
        ))}
        <TextInput
          style={styles.input}
          value={details}
          onChangeText={setDetails}
          placeholder="Conte o que aconteceu (opcional)"
          placeholderTextColor={theme.colors.mutedForeground}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.primary, (!reason || sending) && { opacity: 0.5 }]}
          disabled={!reason || sending}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryText}>{sending ? "Enviando..." : "Enviar denúncia"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: fonts.extraBold, color: "#fff" },
  content: { paddingHorizontal: 20, gap: 10, paddingBottom: 40 },
  text: { fontSize: 14, fontFamily: fonts.medium, color: theme.colors.mutedForeground, lineHeight: 21, marginBottom: 4 },
  option: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  optionOn: { borderColor: theme.colors.primary, backgroundColor: "rgba(255,102,0,0.1)" },
  optionText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#fff" },
  optionTextOn: { color: theme.colors.primary },
  input: {
    minHeight: 100,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#fff",
    textAlignVertical: "top",
    backgroundColor: "rgba(28,28,58,0.92)",
  },
  primary: { backgroundColor: theme.colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  primaryText: { fontSize: 16, fontFamily: fonts.bold, color: "#fff" },
}));
