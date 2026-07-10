import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Fragment, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { SupportTicket } from "@/lib/api";
import { fonts } from "@/constants/fonts";
import { relativeTime, supportCategoryLabel, supportStatusLabel } from "@/lib/format";
import { useSupportTickets } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

const faqs: { id: string; icon: React.ComponentProps<typeof Ionicons>["name"]; question: string; answer: string }[] = [
  {
    id: "earnings",
    icon: "wallet-outline",
    question: "Como recebo pelos serviços concluídos?",
    answer:
      "Ao concluir um pedido, o valor (já descontada a taxa de 8% da plataforma) entra no saldo da sua carteira, visível em Ganhos. O saque depende de completar o cadastro de KYC.",
  },
  {
    id: "kyc",
    icon: "shield-checkmark-outline",
    question: "Por que meu perfil ainda não aparece pros clientes?",
    answer:
      "Todo prestador passa por verificação de documento antes de ficar visível no app. Complete seu cadastro profissional em Perfil > Completar cadastro e aguarde a aprovação.",
  },
  {
    id: "cancel",
    icon: "close-circle-outline",
    question: "Posso recusar ou cancelar um pedido?",
    answer:
      "Você pode recusar um pedido assim que ele chega. Depois de aceitar, o cancelamento pelo seu lado segue as regras de disputa — se algo impedir o atendimento, abra um chamado explicando o caso.",
  },
  {
    id: "availability",
    icon: "toggle-outline",
    question: "Como fico indisponível temporariamente?",
    answer:
      "No seu painel, use o botão Disponível/Offline no topo — enquanto estiver offline você continua listado, mas os clientes veem que não está atendendo no momento.",
  },
  {
    id: "account",
    icon: "person-outline",
    question: "Posso exportar ou excluir meus dados?",
    answer:
      "Sim, a qualquer momento em Perfil > Privacidade: \"Baixar meus dados\" gera uma cópia de tudo que você cadastrou, e \"Excluir minha conta\" remove suas informações pessoais.",
  },
];

const STATUS_COLOR: Record<SupportTicket["status"], "warning" | "info" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
};

export default function ProviderSupport() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { data: tickets, isLoading } = useSupportTickets();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.heading}>Como podemos ajudar?</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(isLoading || (tickets && tickets.length > 0)) && (
          <>
            <Text style={styles.sectionTitle}>Meus chamados</Text>
            {isLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: 16 }} />
            ) : (
              <View style={styles.ticketList}>
                {tickets!.map((t) => (
                  <Pressable key={t.id} onPress={() => router.push(`/provider/support-ticket/${t.id}` as never)}>
                    <View style={styles.ticketCard}>
                      <View style={styles.ticketTop}>
                        <Text style={styles.ticketSubject} numberOfLines={1}>
                          {t.subject}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: `${theme.colors[STATUS_COLOR[t.status]]}22` }]}>
                          <Text style={[styles.statusText, { color: theme.colors[STATUS_COLOR[t.status]] }]}>
                            {supportStatusLabel(t.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.ticketMeta}>
                        {supportCategoryLabel(t.category)} · {relativeTime(t.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
        <View style={styles.topicList}>
          {faqs.map((faq, index) => {
            const expanded = openFaq === faq.id;
            return (
              <Fragment key={faq.id}>
                {index > 0 && <View style={styles.divider} />}
                <Pressable onPress={() => setOpenFaq(expanded ? null : faq.id)}>
                  <View style={styles.topicRow}>
                    <View style={styles.topicIcon}>
                      <Ionicons name={faq.icon} size={18} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.topicLabel}>{faq.question}</Text>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={theme.colors.mutedForeground}
                    />
                  </View>
                  {expanded && <Text style={styles.answer}>{faq.answer}</Text>}
                </Pressable>
              </Fragment>
            );
          })}
        </View>

        <Pressable onPress={() => router.push("/provider/support-ticket-new" as never)}>
          <View style={styles.chatButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.chatButtonText}>Abrir um chamado</Text>
          </View>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heading: {
    flex: 1,
    fontSize: 24,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginBottom: 12,
  },
  ticketList: {
    marginBottom: 24,
    gap: 10,
  },
  ticketCard: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
  },
  ticketMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  topicList: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 6,
    marginBottom: 20,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  topicIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  topicLabel: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  answer: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 16,
    marginTop: -6,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 14,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 16,
    paddingVertical: 15,
  },
  chatButtonText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
}));
