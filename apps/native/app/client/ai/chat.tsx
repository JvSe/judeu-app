import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

import { AiAssistant } from "@/components/ai-assistant";
import { CloudAssistant } from "@/components/cloud-assistant";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { aiAvailable } from "@/lib/assistant";

export default function AiChat() {
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
          <Text style={styles.headerName}>JudIA</Text>
          <Text style={styles.headerSub}>
            {available ? "responde no seu aparelho" : "responde pela internet"}
          </Text>
        </View>
      </View>

      {/* Sem o modelo no aparelho (Expo Go / web / aparelho sem suporte): JudIA em nuvem. */}
      {available ? <AiAssistant /> : <CloudAssistant />}
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
}));
