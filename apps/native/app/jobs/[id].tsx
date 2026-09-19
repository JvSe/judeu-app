import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import {
  contractTypeLabel,
  formatShifts,
  jobApplicationStatusLabel,
  moneyFromCents,
} from "@/lib/format";
import { useApplyToJob, useJob } from "@/lib/hooks";

export default function JobDetail() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading } = useJob(id);
  const apply = useApplyToJob();
  const [message, setMessage] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);

  if (isLoading || !job) {
    return (
      <Screen>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const handleApply = () => {
    setApplyError(null);
    apply.mutate(
      { id: job.id, message: message.trim() || undefined },
      {
        onError: (err) =>
          setApplyError(err instanceof Error ? err.message : "Não foi possível enviar sua candidatura."),
      },
    );
  };

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.company}>{job.providerCompany.name}</Text>
        <Text style={styles.meta}>
          {contractTypeLabel(job.contractType)} · {job.category.name}
        </Text>
        <Text style={styles.salary}>
          {job.salaryCents != null ? moneyFromCents(job.salaryCents) : "Salário a combinar"}
        </Text>

        <Text style={styles.sectionLabel}>Descrição</Text>
        <Text style={styles.description}>{job.description}</Text>

        <Text style={styles.sectionLabel}>Escala de trabalho</Text>
        {formatShifts(job.shifts).map((line, i) => (
          <Text key={i} style={styles.shiftLine}>
            {line}
          </Text>
        ))}

        {job.myApplication ? (
          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={styles.statusCardText}>
              Você já se candidatou — status: {jobApplicationStatusLabel(job.myApplication.status)}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Mensagem (opcional)</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Conte por que você é uma boa escolha para essa vaga..."
              placeholderTextColor={theme.colors.mutedForeground}
              multiline
            />
            {applyError && <Text style={styles.errorText}>{applyError}</Text>}
            <Pressable
              style={({ pressed }) => [
                styles.applyButton,
                { opacity: pressed || apply.isPending ? 0.9 : 1 },
              ]}
              onPress={handleApply}
              disabled={apply.isPending}
            >
              {apply.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.applyButtonText}>Candidatar-se</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  company: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 6,
  },
  meta: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  salary: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginTop: 22,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 20,
  },
  shiftLine: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(49,208,127,0.1)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.3)",
    borderRadius: 16,
    padding: 16,
    marginTop: 26,
  },
  statusCardText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  messageInput: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
    minHeight: 90,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: 10,
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 18,
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
