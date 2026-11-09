import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { FormCheckbox } from "@/components/form/checkbox";
import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { useCepAutofill } from "@/lib/cep";
import { formatZipCode } from "@/lib/formatters/format-zipcode.helper";
import { useAddresses, useCreateAddress, useUpdateAddress } from "@/lib/hooks";
import { useCurrentLocation } from "@/lib/location";
import type { AddressFormPrefill } from "@/lib/order-location";
import { errorMessage, toast } from "@/lib/toast";

const addressErrorMessage = "Preencha rua, cidade e estado (UF).";

const addressFormSchema = z.object({
  label: z.string(),
  cep: z.string(),
  street: z.string().trim().min(2, addressErrorMessage),
  number: z.string(),
  complement: z.string(),
  neighborhood: z.string(),
  city: z.string().trim().min(2, addressErrorMessage),
  uf: z
    .string()
    .trim()
    .length(2, addressErrorMessage)
    .transform((v) => v.toUpperCase()),
  isDefault: z.boolean(),
});

type AddressForm = z.infer<typeof addressFormSchema>;

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, 8);
const uppercase = (value: string) => value.toUpperCase();

const fields: {
  name: "street" | "number" | "complement" | "neighborhood" | "city" | "uf";
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  keyboardType?: "numeric" | "default";
  maxLength?: number;
  parseValue?: (v: string) => string;
}[] = [
  { name: "street", label: "Rua", icon: "location-outline", placeholder: "Nome da rua" },
  { name: "number", label: "Número", icon: "home-outline", placeholder: "123", keyboardType: "numeric" },
  {
    name: "complement",
    label: "Complemento (opcional)",
    icon: "business-outline",
    placeholder: "Apto, bloco...",
  },
  { name: "neighborhood", label: "Bairro", icon: "map-outline", placeholder: "Bairro" },
  { name: "city", label: "Cidade", icon: "business-outline", placeholder: "Cidade" },
  {
    name: "uf",
    label: "UF",
    icon: "flag-outline",
    placeholder: "TO",
    maxLength: 2,
    parseValue: uppercase,
  },
];

export default function AddressForm() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id, ...prefill } = useLocalSearchParams<{ id?: string } & Partial<AddressFormPrefill>>();
  const isEditing = !!id;
  // Veio da pergunta "usar localização atual": o GPS é a coordenada do endereço.
  const prefillCoords =
    !isEditing && prefill.lat && prefill.lng
      ? { lat: Number(prefill.lat), lng: Number(prefill.lng) }
      : null;

  const { data: addresses } = useAddresses();
  const existing = addresses?.find((a) => a.id === id);
  const deviceLocation = useCurrentLocation();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, setValue } = useForm<AddressForm>({
    resolver: zodResolver(addressFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      label: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "Palmas",
      uf: "TO",
      isDefault: false,
    },
  });

  // Só preenche uma vez, quando o endereço existente chega do cache/lista.
  useEffect(() => {
    if (!existing) return;
    reset({
      label: existing.label ?? "",
      cep: existing.cep ?? "",
      street: existing.street,
      number: existing.number ?? "",
      complement: existing.complement ?? "",
      neighborhood: existing.neighborhood ?? "",
      city: existing.city,
      uf: existing.state,
      isDefault: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // Cidade e UF ficam vazias se o GPS não as trouxer: o padrão "Palmas" estaria errado aqui.
  useEffect(() => {
    if (!prefillCoords) return;
    reset({
      label: "",
      cep: prefill.cep ?? "",
      street: prefill.street ?? "",
      number: prefill.number ?? "",
      complement: "",
      neighborhood: prefill.neighborhood ?? "",
      city: prefill.city ?? "",
      uf: prefill.uf ?? "",
      isDefault: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { loading: cepLoading, handleCepChange: resolveCep } = useCepAutofill((resolved) => {
    if (resolved.street) setValue("street", resolved.street);
    if (resolved.neighborhood) setValue("neighborhood", resolved.neighborhood);
    if (resolved.city) setValue("city", resolved.city);
    if (resolved.state) setValue("uf", resolved.state);
  });

  const submitting = createAddress.isPending || updateAddress.isPending;

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    const coords = prefillCoords ?? deviceLocation;
    const input = {
      label: data.label.trim() || undefined,
      cep: data.cep.trim() || undefined,
      street: data.street,
      number: data.number.trim() || undefined,
      complement: data.complement.trim() || undefined,
      neighborhood: data.neighborhood.trim() || undefined,
      city: data.city,
      state: data.uf,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
    try {
      if (isEditing && id) {
        await updateAddress.mutateAsync({ id, input });
      } else {
        const created = await createAddress.mutateAsync({ ...input, isDefault: data.isDefault });
        // O cadastro prioriza o geocode do texto; só a edição grava a coordenada enviada.
        if (prefillCoords) {
          await updateAddress
            .mutateAsync({ id: created.id, input })
            .catch((err) => console.warn("[address-form] coordenada do GPS não gravada:", err));
        }
      }
      toast.success(isEditing ? "Endereço atualizado" : "Endereço salvo");
      router.back();
    } catch (e) {
      const message = errorMessage(e, "Não foi possível salvar o endereço.");
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
        <Text style={styles.heading}>{isEditing ? "Editar endereço" : "Novo endereço"}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {prefillCoords && (
          <Text style={styles.prefillHint}>
            Preenchemos pela sua localização. Confira a rua e o número antes de salvar.
          </Text>
        )}

        <FormTextField
          control={control}
          name="label"
          label="Apelido (opcional)"
          icon="bookmark-outline"
          placeholder="Casa, Trabalho..."
          autoCapitalize="words"
        />

        <FormTextField
          control={control}
          name="cep"
          label="CEP"
          icon="mail-outline"
          placeholder="00000-000"
          keyboardType="numeric"
          maxLength={9}
          autoCapitalize="none"
          formatValue={formatZipCode}
          parseValue={digitsOnly}
          onValueChange={resolveCep}
          rightAccessory={
            cepLoading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined
          }
        />

        {fields.map((f) => (
          <FormTextField
            key={f.name}
            control={control}
            name={f.name}
            label={f.label}
            icon={f.icon}
            placeholder={f.placeholder}
            keyboardType={f.keyboardType}
            maxLength={f.maxLength}
            autoCapitalize={f.keyboardType === "numeric" ? "none" : "words"}
            parseValue={f.parseValue}
          />
        ))}

        {!isEditing && (
          <FormCheckbox control={control} name="isDefault" containerStyle={styles.defaultSpacing}>
            <Text style={styles.defaultText}>Definir como endereço padrão</Text>
          </FormCheckbox>
        )}

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || submitting ? 0.9 : 1 }]}
          onPress={() => void onValid()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Salvar endereço</Text>
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
    paddingTop: 22,
    paddingBottom: 40,
  },
  prefillHint: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.primary,
    marginBottom: 16,
  },
  defaultSpacing: {
    marginTop: 6,
    marginBottom: 6,
  },
  defaultText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: "#9997bd",
  },
  submitError: {
    marginTop: 6,
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
