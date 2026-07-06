import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";

const digits = ["7", "3", "", ""];

export default function Otp() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={styles.glow} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={27} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Confirme seu número</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 4 dígitos por SMS para{"\n"}
          <Text style={styles.phone}>(11) 98765-4321</Text>
        </Text>

        <View style={styles.codeRow}>
          {digits.map((digit, index) => {
            const active = index === 2;
            return (
              <View key={index} style={[styles.codeBox, active && styles.codeBoxActive]}>
                {digit ? (
                  <Text style={styles.codeDigit}>{digit}</Text>
                ) : active ? (
                  <View style={styles.caret} />
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.resend}>
          Reenviar código em <Text style={styles.resendTime}>0:42</Text>
        </Text>
        <Text style={styles.call}>Receber por ligação</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed ? 0.9 : 0.55 }]}
          onPress={() => router.replace("/client")}
        >
          <Text style={styles.submitText}>Verificar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  glow: {
    position: "absolute",
    top: -90,
    left: "50%",
    width: 340,
    height: 340,
    borderRadius: 170,
    marginLeft: -170,
    backgroundColor: "rgba(255,102,0,0.12)",
  },
  topBar: {
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: "rgba(255,102,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.7,
    marginTop: 22,
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 9,
    lineHeight: 22,
  },
  phone: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  codeRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 34,
  },
  codeBox: {
    width: 64,
    height: 72,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxActive: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  codeDigit: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  caret: {
    width: 2,
    height: 30,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  resend: {
    textAlign: "center",
    marginTop: 26,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  resendTime: {
    color: "#fff",
    fontFamily: fonts.extraBold,
  },
  call: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  submitText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#fff",
  },
}));
