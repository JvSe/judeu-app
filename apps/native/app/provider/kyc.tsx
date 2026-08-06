import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useController, useFieldArray, useForm } from "react-hook-form";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import { FormChipSelect } from "@/components/form/chip-select";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import { useCategories, useMyProviderProfile, useUploadProviderDocument, useUpsertProviderProfile } from "@/lib/hooks";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Em análise",
  APPROVED: "Aprovado",
  BLOCKED: "Bloqueado",
};

const priceCentsSchema = z.string().transform((v, ctx) => {
  const cents = Math.round(Number(v.replace(",", ".")) * 100);
  if (!Number.isFinite(cents) || cents < 100) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return cents;
});

const kycSchema = z
  .object({
    headline: z.string().trim().min(2, "Conte o que você faz"),
    bio: z.string(),
    yearsExperience: z.string(),
    serviceRadiusKm: z.string(),
    categoryId: z.string().min(1, "Escolha uma categoria."),
    allowsNegotiation: z.boolean(),
    isCompany: z.boolean(),
    companyName: z.string(),
    responsibleName: z.string(),
    services: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Nome do serviço muito curto"),
          priceCents: priceCentsSchema,
        }),
      )
      .min(1, "Adicione ao menos um serviço."),
  })
  .superRefine((data, ctx) => {
    if (!data.isCompany) return;
    if (data.companyName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o nome da empresa",
        path: ["companyName"],
      });
    }
    if (data.responsibleName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o nome do responsável",
        path: ["responsibleName"],
      });
    }
  });

type KycFormInput = z.input<typeof kycSchema>;
type KycFormOutput = z.output<typeof kycSchema>;

export default function ProviderKyc() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const { data: categories = [] } = useCategories();
  const { data: profile, isLoading } = useMyProviderProfile();
  const upsertProfile = useUpsertProviderProfile();
  const uploadDocument = useUploadProviderDocument();

  const [document, setDocument] = useState<{ uri: string; base64: string; mimeType: string } | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<KycFormInput, unknown, KycFormOutput>({
    resolver: zodResolver(kycSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      headline: "",
      bio: "",
      yearsExperience: "0",
      serviceRadiusKm: "10",
      categoryId: "",
      allowsNegotiation: false,
      isCompany: false,
      companyName: "",
      responsibleName: "",
      services: [],
    },
  });
  const { field: allowsNegotiationField } = useController({ control, name: "allowsNegotiation" });
  const { field: isCompanyField } = useController({ control, name: "isCompany" });
  const { fields, append, remove } = useFieldArray({ control, name: "services" });

  // Pré-preenche o form quando o cadastro profissional já existe (edição).
  useEffect(() => {
    if (!profile) return;
    reset({
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      yearsExperience: String(profile.yearsExperience),
      serviceRadiusKm: String(profile.serviceRadiusKm),
      categoryId: profile.categoryIds[0] ?? "",
      allowsNegotiation: profile.allowsNegotiation,
      isCompany: profile.isCompany,
      companyName: profile.companyName ?? "",
      responsibleName: profile.responsibleName ?? "",
      services: profile.services.map((s) => ({
        name: s.name,
        priceCents: (s.priceCents / 100).toFixed(2).replace(".", ","),
      })),
    });
  }, [profile, reset]);

  const hasDocument = document !== null || !!profile?.hasDocument;

  async function pickDocument() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setSubmitError("Precisamos de acesso às fotos para enviar o documento.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setDocument({
      uri: asset.uri,
      base64: asset.base64!,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    setSubmitError(null);
  }

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    if (!hasDocument) {
      setSubmitError("Envie uma foto do seu documento de identidade.");
      return;
    }
    try {
      await upsertProfile.mutateAsync({
        headline: data.headline,
        bio: data.bio.trim() || undefined,
        yearsExperience: Number(data.yearsExperience) || 0,
        serviceRadiusKm: Number(data.serviceRadiusKm) || 10,
        allowsNegotiation: data.allowsNegotiation,
        isCompany: data.isCompany,
        companyName: data.isCompany ? data.companyName.trim() : undefined,
        responsibleName: data.isCompany ? data.responsibleName.trim() : undefined,
        categoryIds: [data.categoryId],
        services: data.services.map((s) => ({
          name: s.name,
          priceCents: s.priceCents,
          categoryId: data.categoryId,
        })),
      });
      if (document) {
        await uploadDocument.mutateAsync({ base64: document.base64, mimeType: document.mimeType });
      }
      router.replace("/provider");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar seu cadastro.");
    }
  });

  const submitting = upsertProfile.isPending || uploadDocument.isPending;
  const statusLabel = useMemo(
    () => (profile?.status ? STATUS_LABEL[profile.status] : null),
    [profile?.status],
  );

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        {statusLabel && (
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{statusLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Cadastro profissional</Text>
        <Text style={styles.subtitle}>
          Conte o que você faz e envie seu documento — clientes só te encontram depois da aprovação.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Categoria</Text>
          <FormChipSelect
            control={control}
            name="categoryId"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <Text style={styles.label}>O que você faz</Text>
          <FormInput control={control} name="headline" placeholder="Ex.: Eletricista" />

          <Text style={styles.label}>Sobre você (opcional)</Text>
          <FormInput
            control={control}
            name="bio"
            placeholder="Experiência, especialidades..."
            multiline
          />

          <View style={styles.row2}>
            <FormInput
              control={control}
              name="yearsExperience"
              label="Anos de experiência"
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
            <FormInput
              control={control}
              name="serviceRadiusKm"
              label="Raio de atuação (km)"
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
          </View>

          <Text style={styles.label}>Tipo de perfil</Text>
          <View style={styles.negotiationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.negotiationTitle}>Sou uma empresa</Text>
              <Text style={styles.negotiationDetail}>
                Ative se você representa uma empresa. O nome exibido aos clientes passa a ser o
                do responsável, com o nome da empresa como informação adicional.
              </Text>
            </View>
            <Pressable
              style={[styles.toggle, isCompanyField.value ? styles.toggleOn : styles.toggleOff]}
              onPress={() => isCompanyField.onChange(!isCompanyField.value)}
            >
              <View style={[styles.knob, isCompanyField.value ? styles.knobOn : styles.knobOff]} />
            </Pressable>
          </View>

          {isCompanyField.value && (
            <>
              <Text style={styles.label}>Nome da empresa</Text>
              <FormInput control={control} name="companyName" placeholder="Ex.: Construtora XYZ Ltda" />

              <Text style={styles.label}>Nome do responsável</Text>
              <FormInput control={control} name="responsibleName" placeholder="Nome de quem responde pela empresa" />
            </>
          )}

          <Text style={styles.label}>Serviços e preços</Text>
          {fields.map((field, index) => (
            <View key={field.id} style={styles.serviceRow}>
              <FormInput
                control={control}
                name={`services.${index}.name`}
                placeholder="Nome do serviço"
                containerStyle={styles.serviceNameField}
              />
              <FormInput
                control={control}
                name={`services.${index}.priceCents`}
                placeholder="Preço"
                keyboardType="decimal-pad"
                containerStyle={styles.servicePriceField}
              />
              <Pressable onPress={() => remove(index)} hitSlop={10} style={styles.removeServiceButton}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.destructive} />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={styles.addServiceButton}
            onPress={() => append({ name: "", priceCents: "" })}
            hitSlop={10}
          >
            <Ionicons name="add" size={18} color={theme.colors.primary} />
            <Text style={styles.addServiceButtonText}>Adicionar serviço</Text>
          </Pressable>
          {formState.errors.services?.root?.message && (
            <FormErrorText>{formState.errors.services.root.message}</FormErrorText>
          )}

          <Text style={styles.label}>Negociação de orçamento</Text>
          <View style={styles.negotiationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.negotiationTitle}>Permitir negociar valor</Text>
              <Text style={styles.negotiationDetail}>
                Clientes poderão propor outro valor antes de você aceitar o pedido, e você também
                pode contrapropor. Desligado, o pedido segue direto pro pagamento.
              </Text>
            </View>
            <Pressable
              style={[
                styles.toggle,
                allowsNegotiationField.value ? styles.toggleOn : styles.toggleOff,
              ]}
              onPress={() => allowsNegotiationField.onChange(!allowsNegotiationField.value)}
            >
              <View
                style={[styles.knob, allowsNegotiationField.value ? styles.knobOn : styles.knobOff]}
              />
            </Pressable>
          </View>

          <Text style={styles.label}>Documento de identidade</Text>
          {document || profile?.hasDocument ? (
            <View style={[styles.doneCard]}>
              {document ? (
                <Image source={{ uri: document.uri }} style={styles.docThumb} />
              ) : (
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={20} color={theme.colors.success} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.doneTitle}>Documento enviado</Text>
                <Text style={styles.doneMeta}>Toque em substituir para trocar a foto</Text>
              </View>
              <Pressable onPress={pickDocument}>
                <Text style={styles.replaceText}>Substituir</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.uploadCard} onPress={pickDocument}>
              <View style={styles.uploadIcon}>
                <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={styles.uploadTitle}>Enviar documento com foto</Text>
              <Text style={styles.uploadText}>RG, CNH ou outro documento oficial com foto</Text>
              <View style={styles.uploadButton}>
                <Text style={styles.uploadButtonText}>Escolher foto</Text>
              </View>
            </Pressable>
          )}

          {submitError && <FormErrorText style={styles.errorText}>{submitError}</FormErrorText>}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.success} />
          <Text style={styles.secureText}>Seus dados são criptografados e nunca compartilhados</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || submitting ? 0.9 : 1 }]}
          onPress={onValid}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{profile ? "Atualizar cadastro" : "Enviar para análise"}</Text>
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
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  statusChip: {
    backgroundColor: "rgba(255,102,0,0.14)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.7,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 8,
    lineHeight: 21,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 9,
    marginTop: 16,
  },
  row2: {
    flexDirection: "row",
    gap: 12,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  serviceNameField: {
    flex: 2,
  },
  servicePriceField: {
    flex: 1,
  },
  removeServiceButton: {
    padding: 4,
  },
  addServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,102,0,0.5)",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  addServiceButtonText: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  negotiationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
  },
  negotiationTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  negotiationDetail: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
    lineHeight: 17,
  },
  toggle: {
    width: 42,
    height: 25,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: theme.colors.primary,
  },
  toggleOff: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    position: "absolute",
    backgroundColor: "#fff",
  },
  knobOn: {
    right: 3,
  },
  knobOff: {
    left: 3,
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(49,208,127,0.35)",
    borderRadius: 18,
    padding: 16,
  },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(49,208,127,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  docThumb: {
    width: 44,
    height: 44,
    borderRadius: 13,
  },
  doneTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  doneMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 1,
  },
  replaceText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  uploadCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,102,0,0.5)",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  uploadIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,102,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 12,
  },
  uploadText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 5,
    textAlign: "center",
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 14,
  },
  uploadButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  errorText: {
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(13,13,36,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  secureText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
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
