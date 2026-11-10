import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { OtpInput } from "@/components/ui/base/otp-input";
import { AuthBackground } from "@/components/auth-background";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { errorMessage, toast } from "@/lib/toast";

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

const OTP_LENGTH = 6;
const OTP_BOX_HEIGHT = 60;
const OTP_BOX_GAP = 12;
// Altura fixa do OtpInput quando mostra a mensagem de erro abaixo das caixas.
const OTP_HEIGHT_WITH_ERROR = 120;
const SCREEN_PADDING = 24;

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [codeRejected, setCodeRejected] = useState<string | null>(null);
  const otpBoxWidth = Math.min(
    52,
    Math.floor((windowWidth - SCREEN_PADDING * 2 - OTP_BOX_GAP * OTP_LENGTH) / OTP_LENGTH),
  );

  const { control, handleSubmit, formState } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  const { field: codeField, fieldState: codeState } = useController({ control, name: "code" });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    setCodeRejected(null);
    try {
      await resetPassword({ email, code: data.code, newPassword: data.newPassword });
      toast.success("Senha atualizada");
      router.replace("/client");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : errorMessage(e, "Não foi possível trocar a senha.");
      // O servidor responde 400 quando o código está errado ou expirou.
      if (e instanceof ApiError && e.status === 400) {
        setCodeRejected(message);
      } else {
        setSubmitError(message);
      }
      toast.error(message);
    }
  });

  return (
    <Screen>
      <AuthBackground />

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
          Digite o código de 6 dígitos que enviamos por e-mail.{"\n"}
          Conta: <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.fieldSpacing}>
          <Text style={styles.codeLabel}>Código</Text>
          <View
            style={[
              styles.otpWrap,
              { height: codeRejected ? OTP_HEIGHT_WITH_ERROR : OTP_BOX_HEIGHT },
            ]}
          >
            <OtpInput
              otpCount={OTP_LENGTH}
              enableAutoFocus
              editable={!formState.isSubmitting}
              inputWidth={otpBoxWidth}
              inputHeight={OTP_BOX_HEIGHT}
              inputBorderRadius={16}
              textStyle={styles.codeDigit}
              focusedBackgroundColor="rgba(28,28,58,0.85)"
              unfocusedBackgroundColor="rgba(28,28,58,0.85)"
              focusedBorderColor={theme.colors.primary}
              unfocusedBorderColor="rgba(255,255,255,0.1)"
              errorBorderColor={theme.colors.destructive}
              error={!!codeRejected}
              errorMessage={codeRejected ?? undefined}
              onInputChange={(code) => {
                codeField.onChange(code);
                if (code) setCodeRejected(null);
              }}
            />
          </View>
          {codeState.error?.message && <FormErrorText>{codeState.error.message}</FormErrorText>}
        </View>

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
          onSubmitEditing={() => void onValid()}
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
          onPress={() => void onValid()}
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
  codeLabel: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  // O OtpInput ocupa a largura da janela; compensa o padding da tela.
  otpWrap: {
    marginHorizontal: -SCREEN_PADDING,
  },
  codeDigit: {
    fontSize: 24,
    fontFamily: fonts.extraBold,
    fontWeight: "normal",
    color: "#fff",
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
