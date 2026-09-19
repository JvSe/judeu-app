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

export default function NewJobPosting() {
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useCategories();
  const createJob = useCreateJobPosting();
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Nova vaga</Text>
        <Text style={styles.subtitle}>Preencha os dados e a escala de trabalho para publicar.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <JobPostingForm
          categories={categories}
          confirmLabel="Publicar vaga"
          submitting={createJob.isPending}
          onConfirm={async (input) => {
            setSubmitError(null);
            try {
              const job = await createJob.mutateAsync(input);
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
  intro: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.7,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 8,
    lineHeight: 21,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  errorText: {
    marginTop: 12,
  },
}));
