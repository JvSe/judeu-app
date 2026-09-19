import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import SpinButton from "@/components/ui/spin-button";
import { initialsOf, jobApplicationStatusLabel, shortDateTime } from "@/lib/format";
import { useJobApplicants, useRespondToApplication } from "@/lib/hooks";

export default function JobApplicants() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: applicants = [], isLoading } = useJobApplicants(id);
  const respond = useRespondToApplication();
  const [pending, setPending] = useState<{ id: string; action: "accept" | "reject" } | null>(null);

  const act = (applicationId: string, action: "accept" | "reject") => {
    setPending({ id: applicationId, action });
    respond.mutate(
      { jobId: id, applicationId, action },
      {
        onError: (err) =>
          Alert.alert("Ops", err instanceof Error ? err.message : "Não foi possível responder."),
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Candidatos</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />}
        {!isLoading && applicants.length === 0 && (
          <Text style={styles.emptyText}>Ninguém se candidatou ainda.</Text>
        )}
        {applicants.map((a) => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar initials={initialsOf(a.applicant.name)} color="#3a3a70" size={44} radius={13} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{a.applicant.name}</Text>
                <Text style={styles.cardMeta}>{shortDateTime(a.createdAt)}</Text>
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
            </View>
            {a.message && <Text style={styles.message}>{a.message}</Text>}
            {a.status === "PENDING" && (
              <View style={styles.actions}>
                <SpinButton
                  controlled
                  isActive={pending?.id === a.id && pending.action === "reject"}
                  disabled={respond.isPending}
                  idleText="Recusar"
                  activeText="Recusando..."
                  onPress={() => act(a.id, "reject")}
                  colors={{
                    idle: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                    active: { background: "rgba(255,255,255,0.06)", text: theme.colors.mutedForeground },
                  }}
                  buttonStyle={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13, fontSize: 13.5 }}
                  spinnerConfig={{
                    color: theme.colors.mutedForeground,
                    containerBackground: "rgba(255,255,255,0.06)",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <SpinButton
                    controlled
                    isActive={pending?.id === a.id && pending.action === "accept"}
                    disabled={respond.isPending}
                    idleText="Aceitar"
                    activeText="Aceitando..."
                    onPress={() => act(a.id, "accept")}
                    colors={{
                      idle: { background: theme.colors.primary, text: "#fff" },
                      active: { background: theme.colors.primary, text: "#fff" },
                    }}
                    buttonStyle={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 13, fontSize: 14.5 }}
                    spinnerConfig={{ color: "#fff", containerBackground: theme.colors.primary }}
                  />
                </View>
              </View>
            )}
          </View>
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
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  message: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 19,
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
  actions: {
    flexDirection: "row",
    gap: 10,
  },
}));
