import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

const understanding = [
  { label: "Serviço:", value: "Encanamento — reparo de sifão" },
  { label: "Urgência:", value: "Média · sem alagamento" },
  { label: "Estimativa:", value: "R$ 90 – R$ 140" },
];

const chips = ["📷 Enviar foto", "É urgente", "Hoje"];

export default function AiChat() {
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
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>analisando seu pedido</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <View style={[styles.bubble, styles.aiBubble]}>
          <Text style={styles.aiText}>Oi! 👋 Me conta rapidinho: o que você precisa resolver?</Text>
        </View>
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>A pia da cozinha tá vazando embaixo, acho que é o sifão</Text>
        </View>

        <View style={styles.understandCard}>
          <Text style={styles.understandTitle}>Entendi o problema</Text>
          <View style={{ gap: 9 }}>
            {understanding.map((item) => (
              <View key={item.label} style={styles.understandRow}>
                <Ionicons name="checkmark" size={17} color={theme.colors.success} />
                <Text style={styles.understandText}>
                  <Text style={styles.understandLabel}>{item.label}</Text> {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.typing}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <Text style={styles.typingText}>buscando profissionais…</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.seeResult, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push("/client/ai/result" as never)}
        >
          <Text style={styles.seeResultText}>Ver recomendação da IA</Text>
          <Ionicons name="arrow-forward" size={17} color="#fff" />
        </Pressable>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map((chip, index) => (
            <View key={chip} style={[styles.chip, index === 0 && styles.chipHighlighted]}>
              <Text style={[styles.chipText, index === 0 && styles.chipTextHighlighted]}>{chip}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <View style={styles.input}>
            <Text style={styles.inputPlaceholder}>Responder à IA…</Text>
          </View>
          <Pressable
            style={styles.sendButton}
            onPress={() => router.push("/client/ai/result" as never)}
          >
            <Ionicons name="send" size={19} color="#fff" />
          </Pressable>
        </View>
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.success,
  },
  messages: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(28,28,58,0.9)",
    borderBottomLeftRadius: 6,
  },
  aiText: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
    lineHeight: 21,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  userText: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
    lineHeight: 21,
  },
  understandCard: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.25)",
    borderRadius: 18,
    padding: 15,
  },
  understandTitle: {
    fontSize: 11.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  understandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  understandText: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
    lineHeight: 21,
  },
  understandLabel: {
    fontFamily: fonts.bold,
    color: "#fff",
  },
  typing: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  typingText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginLeft: 4,
  },
  seeResult: {
    alignSelf: "stretch",
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  seeResultText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  inputBar: {
    backgroundColor: "rgba(20,20,44,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingTop: 11,
  },
  chipsRow: {
    gap: 8,
    marginBottom: 11,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipHighlighted: {
    backgroundColor: "rgba(255,102,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.3)",
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#b9b7d6",
  },
  chipTextHighlighted: {
    color: "#FF9a52",
    fontFamily: fonts.bold,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderRadius: 23,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  inputPlaceholder: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#6b699a",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
}));
