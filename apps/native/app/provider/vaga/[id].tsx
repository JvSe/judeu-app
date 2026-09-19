import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { contractTypeLabel, formatShifts, jobStatusLabel, moneyFromCents } from "@/lib/format";
import { useMyJobPosting, useSetJobPostingStatus } from "@/lib/hooks";

export default function JobPostingDetail() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading } = useMyJobPosting(id);
  const setStatus = useSetJobPostingStatus();

  if (isLoading || !job) {
    return (
      <Screen>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <View style={[styles.statusChip, job.status === "CLOSED" && styles.statusChipClosed]}>
          <Text style={[styles.statusChipText, job.status === "CLOSED" && styles.statusChipTextClosed]}>
            {jobStatusLabel(job.status)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{job.title}</Text>
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

        <Pressable
          style={styles.applicantsRow}
          onPress={() =>
            router.push({ pathname: "/provider/vaga/applicants/[id]", params: { id: job.id } })
          }
        >
          <Ionicons name="people-outline" size={19} color={theme.colors.primary} />
          <Text style={styles.applicantsText}>Ver candidatos ({job.applicantCount})</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.toggleButton, { opacity: pressed || setStatus.isPending ? 0.85 : 1 }]}
          onPress={() =>
            setStatus.mutate({ id: job.id, status: job.status === "OPEN" ? "CLOSED" : "OPEN" })
          }
          disabled={setStatus.isPending}
        >
          {setStatus.isPending ? (
            <ActivityIndicator color={theme.colors.foreground} />
          ) : (
            <Text style={styles.toggleButtonText}>
              {job.status === "OPEN" ? "Fechar vaga" : "Reabrir vaga"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  statusChip: {
    backgroundColor: "rgba(49,208,127,0.16)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipClosed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statusChipText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  statusChipTextClosed: {
    color: theme.colors.mutedForeground,
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
  meta: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 6,
  },
  salary: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
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
  applicantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 22,
  },
  applicantsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  toggleButton: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  toggleButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
}));
