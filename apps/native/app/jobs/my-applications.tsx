import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { jobApplicationStatusLabel, shortDateTime } from "@/lib/format";
import { useMyApplications } from "@/lib/hooks";

export default function MyApplications() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: applications = [], isLoading } = useMyApplications();

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Minhas candidaturas</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />}
        {!isLoading && applications.length === 0 && (
          <Text style={styles.emptyText}>Você ainda não se candidatou a nenhuma vaga.</Text>
        )}
        {applications.map((a) => (
          <Pressable
            key={a.id}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() =>
              router.push({ pathname: "/jobs/[id]", params: { id: a.jobPosting.id } })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{a.jobPosting.title}</Text>
              <Text style={styles.cardMeta}>
                {a.jobPosting.companyName} · {shortDateTime(a.createdAt)}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                a.status === "ACCEPTED" && styles.statusChipAccepted,
                a.status === "REJECTED" && styles.statusChipRejected,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  a.status === "ACCEPTED" && styles.statusChipTextAccepted,
                  a.status === "REJECTED" && styles.statusChipTextRejected,
                ]}
              >
                {jobApplicationStatusLabel(a.status)}
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
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: 30,
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
    backgroundColor: "rgba(255,102,0,0.16)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipAccepted: {
    backgroundColor: "rgba(49,208,127,0.16)",
  },
  statusChipRejected: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statusChipText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  statusChipTextAccepted: {
    color: theme.colors.success,
  },
  statusChipTextRejected: {
    color: theme.colors.mutedForeground,
  },
}));
