import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { z } from "zod";

import { Screen } from "@/components/ui/screen";
import { FormCheckbox } from "@/components/form/checkbox";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { formatPhone } from "@/lib/formatters/format-phone.helper";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo"),
  email: z.string().trim().transform((v) => v.toLowerCase()),
  phone: z.string(),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres"),
  accepted: z.boolean().refine((v) => v === true, "Aceite os termos para continuar"),
});

type SignupForm = z.infer<typeof signupSchema>;

const unformatPhone = (value: string) => value.replace(/\D/g, "");

const fields: {
  name: "fullName" | "email" | "phone";
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  keyboardType?: "email-address" | "phone-pad";
  autoComplete?: "name" | "email" | "tel";
  formatValue?: (raw: string) => string;
  parseValue?: (input: string) => string;
}[] = [
  {
    name: "fullName",
    label: "Nome completo",
    icon: "person-outline",
    placeholder: "Seu nome",
    autoComplete: "name",
  },
  {
    name: "email",
    label: "E-mail",
    icon: "mail-outline",
    placeholder: "seu@email.com",
    keyboardType: "email-address",
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "Celular",
    icon: "phone-portrait-outline",
    placeholder: "(11) 90000-0000",
    keyboardType: "phone-pad",
    autoComplete: "tel",
    formatValue: formatPhone,
    parseValue: unformatPhone,
  },
];

export default function Signup() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const role = intent === "work" ? "PROVIDER" : "CLIENT";
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { fullName: "", email: "", phone: "", password: "", accepted: false },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await signUp({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        role,
        acceptedTerms: true,
      });
      router.replace(role === "PROVIDER" ? "/provider/kyc" : "/client");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível criar a conta");
    }
  });

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

        {fields.map((f) => (
          <FormTextField
            key={f.name}
            control={control}
            name={f.name}
            label={f.label}
            icon={f.icon}
            placeholder={f.placeholder}
            keyboardType={f.keyboardType}
            autoCapitalize={f.keyboardType === "email-address" ? "none" : "words"}
            autoComplete={f.autoComplete}
            formatValue={f.formatValue}
            parseValue={f.parseValue}
            editable={!formState.isSubmitting}
          />
        ))}

        <FormTextField
          control={control}
          name="password"
          label="Senha"
          icon="lock-closed-outline"
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          editable={!formState.isSubmitting}
        />

        <FormCheckbox control={control} name="accepted" containerStyle={styles.termsSpacing}>
          <Text style={styles.termsText}>
            Li e aceito os{" "}
            <Text style={styles.termsLink} onPress={() => router.push("/terms" as never)}>
              Termos de uso
            </Text>{" "}
            e a{" "}
            <Text style={styles.termsLink} onPress={() => router.push("/privacy-policy" as never)}>
              Política de privacidade
            </Text>
          </Text>
        </FormCheckbox>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
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
  termsSpacing: {
    marginTop: 6,
  },
  submitError: {
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
