import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";

export default function Signup() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const role = intent === "work" ? "PROVIDER" : "CLIENT";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    password?: boolean;
    keyboardType?: "email-address" | "phone-pad";
    autoComplete?: "name" | "email" | "tel" | "password-new";
  }[] = [
    { label: "Nome completo", icon: "person-outline", value: fullName, onChangeText: setFullName, placeholder: "Seu nome", autoComplete: "name" },
    { label: "E-mail", icon: "mail-outline", value: email, onChangeText: setEmail, placeholder: "seu@email.com", keyboardType: "email-address", autoComplete: "email" },
    { label: "Celular", icon: "phone-portrait-outline", value: phone, onChangeText: setPhone, placeholder: "(11) 90000-0000", keyboardType: "phone-pad", autoComplete: "tel" },
    { label: "Senha", icon: "lock-closed-outline", value: password, onChangeText: setPassword, placeholder: "Mínimo 8 caracteres", password: true, autoComplete: "password-new" },
  ];

  async function handleSignup() {
    if (loading) return;
    if (!accepted) {
      setError("Aceite os termos para continuar");
      return;
    }
    if (fullName.trim().length < 2) {
      setError("Informe seu nome completo");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa de ao menos 8 caracteres");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        role,
        acceptedTerms: true,
      });
      router.replace(role === "PROVIDER" ? "/provider/kyc" : "/client");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.step}>Passo 1 de 2</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Criar sua conta</Text>
        <Text style={styles.subtitle}>
          Leva menos de 1 minuto. Depois você escolhe se quer contratar ou trabalhar.
        </Text>

        {fields.map((field) => (
          <View key={field.label} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.field}>
              <Ionicons name={field.icon} size={18} color={theme.colors.mutedForeground} />
              <TextInput
                style={[styles.fieldValue, field.password && styles.password]}
                value={field.value}
                onChangeText={field.onChangeText}
                placeholder={field.placeholder}
                placeholderTextColor={theme.colors.mutedForeground}
                secureTextEntry={field.password}
                keyboardType={field.keyboardType}
                autoCapitalize={field.keyboardType === "email-address" ? "none" : "words"}
                autoComplete={field.autoComplete}
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>
        ))}

        <Pressable style={styles.termsRow} onPress={() => setAccepted((v) => !v)}>
          <View style={[styles.checkbox, !accepted && styles.checkboxOff]}>
            {accepted && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
          <Text style={styles.termsText}>
            Li e aceito os{" "}
            <Text style={styles.termsLink} onPress={() => router.push("/terms" as never)}>
              Termos de uso
            </Text>{" "}
            e a{" "}
            <Text
              style={styles.termsLink}
              onPress={() => router.push("/privacy-policy" as never)}
            >
              Política de privacidade
            </Text>
          </Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || loading ? 0.9 : 1 }]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitText}>Criar conta</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  step: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 8,
    lineHeight: 21,
    marginBottom: 20,
  },
  fieldBlock: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  field: {
    height: 54,
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
    fontSize: 17,
    letterSpacing: 3,
  },
  strength: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOff: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    marginTop: 14,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#9997bd",
    lineHeight: 20,
  },
  termsLink: {
    color: theme.colors.primary,
    fontFamily: fonts.bold,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submit: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
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
