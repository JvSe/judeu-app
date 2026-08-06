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

import type { SupportTicketCategory } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/format";
import { useCreateSupportTicket } from "@/lib/hooks";
import { FormChipSelect } from "@/components/form/chip-select";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import { Screen } from "@/components/ui/screen";

const categories = Object.keys(SUPPORT_CATEGORY_LABELS) as SupportTicketCategory[];
const categoryOptions = categories.map((c) => ({ value: c, label: SUPPORT_CATEGORY_LABELS[c] }));

const SUBJECT_PLACEHOLDER: Record<"client" | "provider", string> = {
  client: "Ex.: Cobrança em duplicidade",
  provider: "Ex.: Saldo não caiu na carteira",
};

const supportTicketSchema = z.object({
  category: z.string(),
  subject: z.string().trim().min(3, "Escreva um assunto curto pro chamado."),
  message: z.string().trim().min(10, "Descreva com um pouco mais de detalhe o que aconteceu."),
});

type SupportTicketForm = z.infer<typeof supportTicketSchema>;

export function SupportTicketForm({ role }: { role: "client" | "provider" }) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const createTicket = useCreateSupportTicket();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<SupportTicketForm>({
    resolver: zodResolver(supportTicketSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      category: orderId ? "DISPUTE" : "OTHER",
      subject: "",
      message: "",
    },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      const ticket = await createTicket.mutateAsync({
        category: data.category as SupportTicketCategory,
        subject: data.subject,
        message: data.message,
        orderId,
      });
      router.replace(`/${role}/support-ticket/${ticket.id}` as never);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível abrir o chamado.");
    }
  });

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
        <FormChipSelect
          control={control}
          name="category"
          options={categoryOptions}
          containerStyle={styles.chipSpacing}
        />

        <Text style={styles.label}>Título</Text>
        <FormInput
          control={control}
          name="subject"
          placeholder={SUBJECT_PLACEHOLDER[role]}
          containerStyle={styles.fieldSpacing}
        />

        <Text style={styles.label}>Mensagem</Text>
        <FormInput
          control={control}
          name="message"
          placeholder="Descreva o que aconteceu com o máximo de detalhes possível..."
          multiline
          containerStyle={styles.fieldSpacing}
        />

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || createTicket.isPending ? 0.9 : 1 },
          ]}
          onPress={onValid}
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
  chipSpacing: {
    marginBottom: 18,
  },
  fieldSpacing: {
    marginBottom: 18,
  },
  submitError: {
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
