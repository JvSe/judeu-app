import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { SupportTicketCategory } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/format";
import { useCreateSupportTicket } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

const categories = Object.keys(SUPPORT_CATEGORY_LABELS) as SupportTicketCategory[];

export default function NewProviderSupportTicket() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const createTicket = useCreateSupportTicket();

  const [category, setCategory] = useState<SupportTicketCategory>(orderId ? "DISPUTE" : "OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit() {
    if (subject.trim().length < 3) {
      setErrorMsg("Escreva um assunto curto pro chamado.");
      return;
    }
    if (message.trim().length < 10) {
      setErrorMsg("Descreva com um pouco mais de detalhe o que aconteceu.");
      return;
    }
    setErrorMsg(null);
    try {
      const ticket = await createTicket.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
        orderId,
      });
      router.replace(`/provider/support-ticket/${ticket.id}` as never);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível abrir o chamado.");
    }
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Abrir chamado</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {orderId && (
          <View style={styles.orderBadge}>
            <Ionicons name="cube-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.orderBadgeText}>Vinculado ao pedido #{orderId.slice(0, 8)}</Text>
          </View>
        )}

        <Text style={styles.label}>Assunto</Text>
        <View style={styles.chipRow}>
          {categories.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)}>
              <View style={[styles.chip, category === c && styles.chipActive]}>
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {SUPPORT_CATEGORY_LABELS[c]}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Título</Text>
        <View style={styles.field}>
          <TextInput
            style={styles.fieldValue}
            value={subject}
            onChangeText={setSubject}
            placeholder="Ex.: Saldo não caiu na carteira"
            placeholderTextColor={theme.colors.mutedForeground}
          />
        </View>

        <Text style={styles.label}>Mensagem</Text>
        <View style={[styles.field, styles.fieldMultiline]}>
          <TextInput
            style={[styles.fieldValue, styles.fieldValueMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder="Descreva o que aconteceu com o máximo de detalhes possível..."
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || createTicket.isPending ? 0.9 : 1 }]}
          onPress={handleSubmit}
          disabled={createTicket.isPending}
        >
          {createTicket.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Enviar chamado</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  heading: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 40,
  },
  orderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,102,0,0.14)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 18,
    alignSelf: "flex-start",
  },
  orderBadgeText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  chipTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  field: {
    minHeight: 54,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  fieldMultiline: {
    paddingVertical: 14,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  fieldValueMultiline: {
    minHeight: 110,
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: -8,
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  submitText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
