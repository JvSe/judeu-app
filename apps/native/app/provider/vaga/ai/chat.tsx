import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { VagaAssistant } from "@/components/vaga-schedule-assistant";
import { aiAvailable } from "@/lib/assistant";

export default function VagaAiChat() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const available = aiAvailable();

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
          <Text style={styles.headerName}>Nova vaga</Text>
          <Text style={styles.headerSub}>responde no seu aparelho</Text>
        </View>
        <Pressable onPress={() => router.push("/provider/vaga/new")} hitSlop={8}>
          <Text style={styles.manualLink}>Manual</Text>
        </Pressable>
      </View>

      {available ? (
        <VagaAssistant />
      ) : (
        <View style={styles.unavailable}>
          <Ionicons name="sparkles-outline" size={30} color={theme.colors.mutedForeground} />
          <Text style={styles.unavailableText}>
            O assistente roda no aparelho e precisa de um build de desenvolvimento.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.unavailableButton, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.replace("/provider/vaga/new")}
          >
            <Text style={styles.unavailableButtonText}>Preencher manualmente</Text>
          </Pressable>
        </View>
      )}
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
    marginTop: 1,
  },
  manualLink: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  unavailableText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 20,
    textAlign: "center",
  },
  unavailableButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 8,
  },
  unavailableButtonText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
