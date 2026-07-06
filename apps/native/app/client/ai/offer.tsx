import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";

export default function AiOffer() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.backdrop}>
      <View style={[styles.searchBar, { top: insets.top + 8 }]}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={theme.colors.primary} />
          <Text style={styles.searchText}>pia vazando</Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { top: insets.top + 74 }]}>
        <View style={styles.cardHeader}>
          <LinearGradient colors={["#FF6600", "#ff9248"]} style={styles.sparkIcon}>
            <Ionicons name="sparkles" size={24} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>AJUDA+ IA</Text>
            <Text style={styles.cardTitle}>Quer que eu resolva pra você?</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Me conta em poucas palavras o que está acontecendo. Eu entendo o problema, sugiro a melhor
          solução e chamo os profissionais mais bem avaliados perto de você.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.replace("/client/ai/chat" as never)}
        >
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.primaryText}>Sim, me ajuda</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.ghostButton, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => router.replace("/client/explore")}
        >
          <Text style={styles.ghostText}>Prefiro buscar sozinho</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8,8,22,0.55)",
  },
  searchBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchField: {
    flex: 1,
    height: 52,
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  searchText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#1a1a22",
  },
  cancel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#1e1e46",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.35)",
    borderRadius: 26,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sparkIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 1,
  },
  cardBody: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#b9b7d6",
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginBottom: 11,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  primaryText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  ghostButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
}));
