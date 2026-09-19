import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { FormErrorText } from "@/components/form/error-text";
import { JobPostingForm } from "@/components/screens/job-posting-form";
import { Screen } from "@/components/ui/screen";
import { useCategories, useCreateJobPosting } from "@/lib/hooks";
import { clearJobDraft, getJobDraft, jobDraftToInput } from "@/lib/job-draft";

export default function VagaAiReview() {
  const insets = useSafeAreaInsets();
  const draft = getJobDraft();
  const { data: categories = [] } = useCategories();
  const createJob = useCreateJobPosting();
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!draft) {
    return (
      <Screen>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Não encontramos os dados da vaga. Vamos recomeçar.</Text>
          <Pressable style={styles.emptyButton} onPress={() => router.replace("/provider/vaga/ai/chat")}>
            <Text style={styles.emptyButtonText}>Nova vaga</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

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
        <Text style={styles.title}>Revise antes de publicar</Text>
        <Text style={styles.subtitle}>Ajuste o que quiser — a vaga só é publicada agora.</Text>
        <JobPostingForm
          categories={categories}
          initial={jobDraftToInput(draft)}
          confirmLabel="Publicar vaga"
          submitting={createJob.isPending}
          onConfirm={async (input) => {
            setSubmitError(null);
            try {
              const job = await createJob.mutateAsync(input);
              clearJobDraft();
              router.replace({ pathname: "/provider/vaga/[id]", params: { id: job.id } });
            } catch (e) {
              setSubmitError(e instanceof Error ? e.message : "Não foi possível publicar a vaga.");
            }
          }}
        />
        {submitError && <FormErrorText style={styles.errorText}>{submitError}</FormErrorText>}
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 21,
  },
  errorText: {
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  emptyText: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  emptyButtonText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
