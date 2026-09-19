import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { contractTypeLabel, jobStatusLabel } from "@/lib/format";
import { useMyJobPostings } from "@/lib/hooks";

export default function MyJobPostings() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: jobs = [], isLoading } = useMyJobPostings();

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Minhas vagas</Text>
        <Pressable onPress={() => router.push("/provider/vaga/ai/chat")} hitSlop={10}>
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/provider/vaga/new")}
        style={styles.manualLink}
        hitSlop={8}
      >
        <Text style={styles.manualLinkText}>Preencher manualmente</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />}
        {!isLoading && jobs.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Você ainda não publicou nenhuma vaga.</Text>
            <Pressable onPress={() => router.push("/provider/vaga/new")} hitSlop={8}>
              <Text style={styles.manualLinkText}>Preencher manualmente</Text>
            </Pressable>
          </View>
        )}
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push({ pathname: "/provider/vaga/[id]", params: { id: job.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{job.title}</Text>
              <Text style={styles.cardMeta}>
                {contractTypeLabel(job.contractType)} · {job.applicantCount} candidato(s)
              </Text>
            </View>
            <View style={[styles.statusChip, job.status === "CLOSED" && styles.statusChipClosed]}>
              <Text
                style={[styles.statusChipText, job.status === "CLOSED" && styles.statusChipTextClosed]}
              >
                {jobStatusLabel(job.status)}
              </Text>
            </View>
          </Pressable>
        ))}
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
  title: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  manualLink: {
    alignSelf: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  manualLinkText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  empty: {
    alignItems: "center",
    marginTop: 30,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  cardMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
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
}));
