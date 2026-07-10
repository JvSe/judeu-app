import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";

export default function Login() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const user = await signIn({ email: email.trim().toLowerCase(), password });
      router.replace(user.role === "PROVIDER" ? "/provider" : "/client");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.glow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>A+</Text>
        </View>
        <Text style={styles.title}>Bem-vindo{"\n"}de volta</Text>
        <Text style={styles.subtitle}>Entre para continuar contratando ou trabalhando.</Text>

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
          />
        </View>

        <Text style={styles.label}>Senha</Text>
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={19} color={theme.colors.mutedForeground} />
          <TextInput
            style={[styles.fieldValue, styles.password]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            editable={!loading}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.colors.mutedForeground}
            />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/(auth)/forgot-password" as never)}>
          <Text style={styles.forgot}>Esqueci minha senha</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || loading ? 0.9 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Entrar</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou continue com</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <View style={styles.socialButton}>
            <Text style={styles.socialG}>G</Text>
            <Text style={styles.socialLabel}>Google</Text>
          </View>
          <View style={styles.socialButton}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={styles.socialLabel}>Apple</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
        onPress={() => router.push("/(auth)/signup" as never)}
      >
        <Text style={styles.footerText}>
          Não tem conta? <Text style={styles.footerLink}>Criar conta</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  glow: {
    position: "absolute",
    top: -80,
    left: "50%",
    width: 360,
    height: 360,
    borderRadius: 180,
    marginLeft: -180,
    backgroundColor: "rgba(255,102,0,0.14)",
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 30,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  logoText: {
    fontSize: 29,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  title: {
    fontSize: 33,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
    lineHeight: 37,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 9,
    lineHeight: 22,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginTop: 26,
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
  password: {
    fontSize: 18,
    letterSpacing: 3,
  },
  forgot: {
    textAlign: "right",
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 12,
    marginBottom: 26,
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginBottom: 14,
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#6b699a",
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 54,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialG: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  socialLabel: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#e8e8f5",
  },
  footer: {
    paddingTop: 16,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  footerLink: {
    color: theme.colors.primary,
    fontFamily: fonts.extraBold,
  },
}));
