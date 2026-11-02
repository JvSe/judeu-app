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

import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import type { MyProviderProfile } from "@/lib/api";
import { useMyProviderProfile, useUpdateHelperProfile } from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

const parseRadius = (value: string) => Number(value.replace(",", "."));

const schema = z.object({
  bio: z.string().trim().max(280, "Use no máximo 280 caracteres"),
  serviceRadiusKm: z.string().refine((v) => {
    const n = parseRadius(v);
    return Number.isFinite(n) && n >= 1 && n <= 100;
  }, "Informe um raio entre 1 e 100 km"),
});

type FormValues = z.infer<typeof schema>;

// Cadastro de quem atende ajudas (helper): só bio e raio. Nome/celular ficam em
// "Editar perfil"; o helper não tem categoria, serviços nem KYC.
export default function HelperProfile() {
  const { theme } = useUnistyles();
  const { data: profile, isLoading } = useMyProviderProfile();

  if (isLoading || !profile) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }
  return <HelperProfileForm profile={profile} />;
}

function HelperProfileForm({ profile }: { profile: MyProviderProfile }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const updateHelper = useUpdateHelperProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      bio: profile.bio ?? "",
      serviceRadiusKm: String(profile.serviceRadiusKm),
    },
  });

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      await updateHelper.mutateAsync({
        bio: data.bio,
        serviceRadiusKm: parseRadius(data.serviceRadiusKm),
      });
      toast.success("Cadastro atualizado");
      router.back();
    } catch (e) {
      const message = errorMessage(e, "Não foi possível salvar.");
      setSubmitError(message);
      toast.error(message);
    }
  });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Como você atende</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Essas informações aparecem para quem pede ajuda e definem até onde você vê pedidos no
          mapa.
        </Text>

        <FormTextField
          control={control}
          name="bio"
          label="Como você pode ajudar"
          icon="chatbubble-outline"
          placeholder="Ex.: carrego caixa, busco documento..."
          maxLength={280}
          editable={!updateHelper.isPending}
        />
        <FormTextField
          control={control}
          name="serviceRadiusKm"
          label="Raio de atendimento (km)"
          icon="navigate-circle-outline"
          placeholder="15"
          keyboardType="decimal-pad"
          editable={!updateHelper.isPending}
        />
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.mutedForeground} />
          <Text style={styles.hint}>
            Só pedidos dentro desse raio da sua posição aparecem quando o modo atender está ligado.
          </Text>
        </View>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || updateHelper.isPending ? 0.9 : 1 },
          ]}
          onPress={() => void onValid()}
          disabled={updateHelper.isPending}
        >
          {updateHelper.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Salvar alterações</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  heading: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#9997bd",
    lineHeight: 21,
    marginBottom: 20,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  hint: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 18,
  },
  submitError: {
    marginTop: 12,
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
    alignItems: "center",
    justifyContent: "center",
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
