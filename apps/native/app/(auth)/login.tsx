import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";

const loginSchema = z.object({
  email: z.string().trim().transform((v) => v.toLowerCase()),
  password: z.string(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      const user = await signIn(data);
      router.replace(user.role === "PROVIDER" ? "/provider" : "/client");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível entrar");
    }
  });

  return (
    <Screen>
      <View style={styles.glow} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 30 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require("../../assets/images/icon.png")} style={styles.logo} resizeMode="cover" />
        <Text style={styles.title}>Bem-vindo{"\n"}de volta</Text>
        <Text style={styles.subtitle}>Entre para continuar contratando ou trabalhando.</Text>

        <FormTextField
          control={control}
          name="email"
          label="E-mail"
          icon="mail-outline"
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!formState.isSubmitting}
          containerStyle={styles.fieldSpacing}
        />

        <FormTextField
          control={control}
          name="password"
          label="Senha"
          icon="lock-closed-outline"
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
          editable={!formState.isSubmitting}
          containerStyle={styles.fieldSpacing}
          rightAccessory={
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.colors.mutedForeground}
              />
            </Pressable>
          }
        />

        <Pressable onPress={() => router.push("/(auth)/forgot-password" as never)}>
          <Text style={styles.forgot}>Esqueci minha senha</Text>
        </Pressable>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}

        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || formState.isSubmitting ? 0.9 : 1 },
          ]}
          onPress={onValid}
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? (
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
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
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
  fieldSpacing: {
    marginTop: 26,
    marginBottom: 0,
  },
  forgot: {
    textAlign: "right",
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 12,
    marginBottom: 26,
  },
  submitError: {
    marginTop: 0,
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
