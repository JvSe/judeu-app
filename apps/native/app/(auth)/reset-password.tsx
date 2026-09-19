import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";

const resetPasswordSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
    newPassword: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((val) => val.newPassword === val.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      const user = await resetPassword({ email, code: data.code, newPassword: data.newPassword });
      router.replace(user.role === "PROVIDER" ? "/provider" : "/client");
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Não foi possível trocar a senha.");
    }
  });

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
          No MVP o código é sempre 123456.{"\n"}
          Conta: <Text style={styles.email}>{email}</Text>
        </Text>

        <FormTextField
          control={control}
          name="code"
          label="Código"
          icon="keypad-outline"
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          editable={!formState.isSubmitting}
          parseValue={digitsOnly}
          inputStyle={styles.codeInput}
          containerStyle={styles.fieldSpacing}
        />

        <FormTextField
          control={control}
          name="newPassword"
          label="Nova senha"
          icon="lock-closed-outline"
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
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

        <FormTextField
          control={control}
          name="confirmPassword"
          label="Confirmar nova senha"
          icon="lock-closed-outline"
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!formState.isSubmitting}
          onSubmitEditing={onValid}
          containerStyle={styles.fieldSpacing}
        />

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
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
  fieldSpacing: {
    marginTop: 24,
    marginBottom: 0,
  },
  codeInput: {
    fontSize: 18,
    letterSpacing: 4,
  },
  submitError: {
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
