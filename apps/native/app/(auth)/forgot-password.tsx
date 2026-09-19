import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { authApi, ApiError } from "@/lib/api";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .transform((v) => v.toLowerCase()),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "" },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await authApi.forgotPassword(data.email);
      router.push({ pathname: "/(auth)/reset-password", params: { email: data.email } });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Não foi possível enviar o código.");
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
          <Ionicons name="key-outline" size={27} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Esqueceu sua senha?</Text>
        <Text style={styles.subtitle}>
          Informe o e-mail da sua conta. No MVP o código de recuperação é sempre 123456 — não
          enviamos e-mail.
        </Text>

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
  fieldSpacing: {
    marginTop: 30,
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
