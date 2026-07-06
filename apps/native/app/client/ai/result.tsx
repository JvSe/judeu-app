import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

export default function AiResult() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <LinearGradient colors={["#FF6600", "#ff9248"]} style={styles.avatar}>
          <Ionicons name="sparkles" size={20} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>Ajuda+ IA</Text>
          <Text style={styles.headerSub}>plano pronto</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.recommendation}>
          <Text style={styles.recommendationTitle}>Minha recomendação</Text>
          <Text style={styles.recommendationBody}>
            Pelo que você descreveu, é uma <Text style={styles.bold}>troca de sifão</Text> — serviço
            rápido, ~40 min. Separei os <Text style={styles.bold}>2 encanadores mais bem avaliados</Text>{" "}
            a menos de 2 km, disponíveis hoje. Recomendo o Roberto: melhor nota e mais perto.
          </Text>
        </View>

        <View style={styles.bestHeader}>
          <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
          <Text style={styles.bestHeaderText}>Melhor escolha da IA</Text>
        </View>

        <View style={styles.bestCard}>
          <View style={styles.bestTop}>
            <Avatar initials="RS" color={theme.colors.primary} size={56} radius={16} fontSize={18} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.bestName}>Roberto Silva</Text>
                <Ionicons name="star" size={15} color={theme.colors.primary} />
              </View>
              <Text style={styles.bestMeta}>Encanador · 0,8 km · disponível agora</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeOrange}>
                  <Text style={styles.badgeOrangeText}>★ 4.9 (412)</Text>
                </View>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>98% no prazo</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.bestFooter}>
            <View>
              <Text style={styles.estLabel}>Estimado</Text>
              <Text style={styles.estValue}>R$ 110</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.talkButton, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push({ pathname: "/client/chat/[id]", params: { id: "rafael-souza" } })}
            >
              <Text style={styles.talkText}>Falar com Roberto</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.altLabel}>Outra ótima opção</Text>
        <Pressable
          style={({ pressed }) => [styles.altCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push({ pathname: "/client/provider/[id]", params: { id: "rafael-souza" } })}
        >
          <Avatar initials="JP" color="#3a3a70" size={48} radius={14} />
          <View style={{ flex: 1 }}>
            <Text style={styles.altName}>João Pereira</Text>
            <Text style={styles.altMeta}>Encanador · 1,6 km</Text>
            <Text style={styles.altRating}>★ 4.8 (287)</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.altPrice}>R$ 95</Text>
            <View style={styles.altViewButton}>
              <Text style={styles.altViewText}>Ver</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={styles.footerNote}>A IA já preparou a conversa com o resumo do problema</Text>
        <Pressable
          style={({ pressed }) => [styles.hireButton, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push({ pathname: "/client/payment/[id]", params: { id: "rafael-souza" } })}
        >
          <Text style={styles.hireText}>Contratar agora</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 13,
    backgroundColor: "rgba(20,20,44,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  headerSub: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  content: {
    padding: 16,
    paddingBottom: 150,
  },
  recommendation: {
    backgroundColor: "#1e1e46",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.25)",
    borderRadius: 20,
    padding: 17,
    marginBottom: 20,
  },
  recommendationTitle: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  recommendationBody: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
    lineHeight: 22,
  },
  bold: {
    fontFamily: fonts.bold,
    color: "#fff",
  },
  bestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 11,
  },
  bestHeaderText: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  bestCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  bestTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bestName: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  bestMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  badgeOrange: {
    backgroundColor: "rgba(255,102,0,0.16)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
  },
  badgeOrangeText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
  },
  badgeGreen: {
    backgroundColor: "rgba(49,208,127,0.16)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
  },
  badgeGreenText: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.success,
  },
  bestFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
  },
  estLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  estValue: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  talkButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  talkText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  altLabel: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 10,
  },
  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    padding: 14,
  },
  altName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  altMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  altRating: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: "#FF9a52",
    marginTop: 5,
  },
  altPrice: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  altViewButton: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  altViewText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: "#c9c7e4",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingTop: 13,
  },
  footerNote: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 18,
  },
  hireButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  hireText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
