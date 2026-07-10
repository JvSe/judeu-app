import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { authApi, ApiError } from "@/lib/api";
import { Screen } from "@/components/ui/screen";

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Informe seu e-mail.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(trimmed);
      router.push({ pathname: "/(auth)/reset-password", params: { email: trimmed } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.glow} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={27} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Esqueceu sua senha?</Text>
        <Text style={styles.subtitle}>
          Informe o e-mail da sua conta. Se ele existir, enviamos um código de 6 dígitos para
          criar uma senha nova.
        </Text>

        <Text style={styles.label}>E-mail</Text>
        <View style={styles.field}>
          <Ionicons name="mail-outline" size={19} color={theme.colors.mutedForeground} />
          <TextInput
            style={styles.fieldValue}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={theme.colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || loading ? 0.9 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Enviar código</Text>
          )}
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
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 30,
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
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
    marginTop: 22,
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 9,
    lineHeight: 22,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginTop: 30,
    marginBottom: 8,
  },
  field: {
    height: 56,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: 16,
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
