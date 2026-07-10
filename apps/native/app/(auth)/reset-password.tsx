import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Screen } from "@/components/ui/screen";

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword } = useAuth();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await resetPassword({ email, code, newPassword });
      router.replace(user.role === "PROVIDER" ? "/provider" : "/client");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível trocar a senha.");
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
          <Ionicons name="shield-checkmark-outline" size={27} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Crie uma senha nova</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos para{"\n"}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <Text style={styles.label}>Código</Text>
        <View style={styles.field}>
          <Ionicons name="keypad-outline" size={19} color={theme.colors.mutedForeground} />
          <TextInput
            style={[styles.fieldValue, styles.codeInput]}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={theme.colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
          />
        </View>

        <Text style={styles.label}>Nova senha</Text>
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={19} color={theme.colors.mutedForeground} />
          <TextInput
            style={styles.fieldValue}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
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

        <Text style={styles.label}>Confirmar nova senha</Text>
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={19} color={theme.colors.mutedForeground} />
          <TextInput
            style={styles.fieldValue}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
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
            <Text style={styles.submitText}>Trocar senha</Text>
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
  email: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginTop: 24,
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
  codeInput: {
    fontSize: 18,
    letterSpacing: 4,
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
