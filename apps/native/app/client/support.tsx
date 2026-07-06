import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

const topics: { id: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }[] = [
  { id: "payments", icon: "card-outline", label: "Pagamentos e reembolsos" },
  { id: "cancel", icon: "close-circle-outline", label: "Cancelamento de pedido" },
  { id: "security", icon: "shield-checkmark-outline", label: "Segurança e verificação" },
  { id: "account", icon: "person-outline", label: "Minha conta e dados" },
];

export default function Support() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.heading}>Como podemos ajudar?</Text>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={theme.colors.mutedForeground} />
          <Text style={styles.searchPlaceholder}>Buscar na central de ajuda</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.disputeCard}>
          <View style={styles.disputeTop}>
            <View style={styles.disputeStatus}>
              <Ionicons name="warning-outline" size={15} color="#FF9a2e" />
              <Text style={styles.disputeStatusText}>DISPUTA EM ANÁLISE</Text>
            </View>
            <Text style={styles.disputeId}>#D-0192</Text>
          </View>
          <Text style={styles.disputeTitle}>Serviço incompleto — reparo de sifão</Text>
          <Text style={styles.disputeBody}>
            Nossa equipe está analisando as fotos enviadas. O valor de R$ 110 está retido até a
            resolução.
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>Resposta em até 24h</Text>
          </View>
          <View style={styles.disputeActions}>
            <View style={styles.disputeGhost}>
              <Text style={styles.disputeGhostText}>Ver detalhes</Text>
            </View>
            <View style={styles.disputeSolid}>
              <Text style={styles.disputeSolidText}>Falar com suporte</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tópicos frequentes</Text>
        <View style={styles.topicList}>
          {topics.map((topic, index) => (
            <Fragment key={topic.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.topicRow}>
                <View style={styles.topicIcon}>
                  <Ionicons name={topic.icon} size={18} color={theme.colors.primary} />
                </View>
                <Text style={styles.topicLabel}>{topic.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
              </View>
            </Fragment>
          ))}
        </View>

        <View style={styles.chatButton}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.chatButtonText}>Conversar com o suporte · 24h</Text>
        </View>
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
  searchBar: {
    height: 52,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  searchPlaceholder: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  disputeCard: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,154,46,0.4)",
    borderRadius: 20,
    padding: 17,
    marginBottom: 20,
  },
  disputeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  disputeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  disputeStatusText: {
    fontSize: 12.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a2e",
  },
  disputeId: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  disputeTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
    lineHeight: 21,
  },
  disputeBody: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 6,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    width: "60%",
    height: "100%",
    backgroundColor: "#FF9a2e",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a2e",
  },
  disputeActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  disputeGhost: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  disputeGhostText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#e8e8f5",
  },
  disputeSolid: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  disputeSolidText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginBottom: 12,
  },
  topicList: {
    backgroundColor: "rgba(28,28,58,0.6)",
    borderRadius: 20,
    padding: 6,
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
    marginTop: 16,
  },
  chatButtonText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
}));
