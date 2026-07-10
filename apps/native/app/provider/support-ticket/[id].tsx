import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { SupportTicket } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { shortDateTime, supportCategoryLabel, supportStatusLabel } from "@/lib/format";
import { useSupportTicket } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

const STATUS_COLOR: Record<SupportTicket["status"], "warning" | "info" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
};

export default function ProviderSupportTicketDetail() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ticket, isLoading } = useSupportTicket(id);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Chamado</Text>
      </View>

      {isLoading || !ticket ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <View style={[styles.statusChip, { backgroundColor: `${theme.colors[STATUS_COLOR[ticket.status]]}22` }]}>
              <Text style={[styles.statusText, { color: theme.colors[STATUS_COLOR[ticket.status]] }]}>
                {supportStatusLabel(ticket.status)}
              </Text>
            </View>
            <Text style={styles.meta}>{shortDateTime(ticket.createdAt)}</Text>
          </View>

          <Text style={styles.subject}>{ticket.subject}</Text>
          <Text style={styles.category}>
            {supportCategoryLabel(ticket.category)}
            {ticket.orderId ? ` · pedido #${ticket.orderId.slice(0, 8)}` : ""}
          </Text>

          <View style={styles.messageCard}>
            <Text style={styles.messageLabel}>Sua mensagem</Text>
            <Text style={styles.messageBody}>{ticket.message}</Text>
          </View>

          {ticket.adminResponse ? (
            <View style={[styles.messageCard, styles.responseCard]}>
              <Text style={[styles.messageLabel, { color: theme.colors.primary }]}>Resposta do suporte</Text>
              <Text style={styles.messageBody}>{ticket.adminResponse}</Text>
              {ticket.resolvedAt && (
                <Text style={styles.meta}>{shortDateTime(ticket.resolvedAt)}</Text>
              )}
            </View>
          ) : (
            <View style={styles.waitingCard}>
              <Ionicons name="time-outline" size={18} color={theme.colors.mutedForeground} />
              <Text style={styles.waitingText}>Nossa equipe ainda vai responder esse chamado.</Text>
            </View>
          )}
        </ScrollView>
      )}
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
  },
  meta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  subject: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 14,
  },
  category: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  messageCard: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
    gap: 6,
  },
  responseCard: {
    borderColor: "rgba(255,102,0,0.35)",
  },
  messageLabel: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: theme.colors.mutedForeground,
    letterSpacing: 0.4,
  },
  messageBody: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
    lineHeight: 21,
  },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 16,
    padding: 15,
    marginTop: 20,
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
}));
