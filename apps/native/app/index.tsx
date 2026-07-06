import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";

export default function Onboarding() {
  const { theme } = useUnistyles();
  const { status, user } = useAuth();

  // Já autenticado? Vai direto para a seção do papel.
  if (status === "authenticated") {
    return <Redirect href={user?.role === "PROVIDER" ? "/provider" : "/client"} />;
  }

  return (
    <Screen>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>A+</Text>
        </View>
        <Text style={styles.brand}>
          Ajuda<Text style={{ color: theme.colors.primary }}>+</Text>
        </Text>
        <Text style={styles.tagline}>
          Ajuda + eu. Encontre quem resolve — ou seja quem resolve — pertinho de você.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.card, styles.cardSolid, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push({ pathname: "/(auth)/signup", params: { intent: "hire" } })}
        >
          <View style={styles.cardIconSolid}>
            <Ionicons name="search" size={23} color="#fff" />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitleSolid}>Quero contratar</Text>
            <Text style={styles.cardSubtitleSolid}>Prestadores perto de você</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, styles.cardGlass, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push({ pathname: "/(auth)/signup", params: { intent: "work" } })}
        >
          <View style={styles.cardIconGlass}>
            <Ionicons name="briefcase" size={22} color={theme.colors.foreground} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Quero trabalhar</Text>
            <Text style={styles.cardSubtitle}>Receba pedidos e vagas na sua região</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedForeground} />
        </Pressable>

        <Text style={styles.login}>
          Já tem conta?{" "}
          <Text
            style={{ color: theme.colors.primary, fontFamily: fonts.bold }}
            onPress={() => router.push("/(auth)/login" as never)}
          >
            Entrar
          </Text>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  glowTop: {
    position: "absolute",
    top: -70,
    left: "50%",
    transform: [{ translateX: -180 }],
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(255,102,0,0.16)",
  },
  glowBottom: {
    position: "absolute",
    bottom: 60,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255,102,0,0.08)",
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingHorizontal: 34,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  brand: {
    fontSize: 46,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -1.4,
  },
  tagline: {
    fontSize: 16,
    color: "#9997bd",
    textAlign: "center",
    lineHeight: 25,
    maxWidth: 280,
    fontFamily: fonts.medium,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 44,
    gap: 13,
  },
  card: {
    borderRadius: theme.borderRadius.xxl,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  cardSolid: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  cardGlass: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardIconSolid: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconGlass: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardTitleSolid: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  cardSubtitleSolid: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.medium,
    marginTop: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.medium,
    marginTop: 1,
  },
  login: {
    textAlign: "center",
    color: theme.colors.mutedForeground,
    fontSize: 14,
    marginTop: 8,
    fontFamily: fonts.medium,
  },
}));
