import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { useCepAutofill } from "@/lib/cep";
import { useAddresses, useCreateAddress, useUpdateAddress } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

export default function AddressForm() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const { data: addresses } = useAddresses();
  const existing = addresses?.find((a) => a.id === id);
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();

  const [label, setLabel] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Palmas");
  const [uf, setUf] = useState("TO");
  const [isDefault, setIsDefault] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Só preenche uma vez, quando o endereço existente chega do cache/lista.
  useEffect(() => {
    if (!existing) return;
    setLabel(existing.label ?? "");
    setCep(existing.cep ?? "");
    setStreet(existing.street);
    setNumber(existing.number ?? "");
    setComplement(existing.complement ?? "");
    setNeighborhood(existing.neighborhood ?? "");
    setCity(existing.city);
    setUf(existing.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const { loading: cepLoading, handleCepChange: resolveCep } = useCepAutofill((resolved) => {
    if (resolved.street) setStreet(resolved.street);
    if (resolved.neighborhood) setNeighborhood(resolved.neighborhood);
    if (resolved.city) setCity(resolved.city);
    if (resolved.state) setUf(resolved.state);
  });

  const handleCepChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setCep(digits);
    void resolveCep(digits);
  };

  const submitting = createAddress.isPending || updateAddress.isPending;

  async function handleSave() {
    if (street.trim().length < 2 || city.trim().length < 2 || uf.trim().length !== 2) {
      setErrorMsg("Preencha rua, cidade e estado (UF).");
      return;
    }
    setErrorMsg(null);
    const input = {
      label: label.trim() || undefined,
      cep: cep.trim() || undefined,
      street: street.trim(),
      number: number.trim() || undefined,
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim(),
      state: uf.trim().toUpperCase(),
    };
    try {
      if (isEditing && id) {
        await updateAddress.mutateAsync({ id, input });
      } else {
        await createAddress.mutateAsync({ ...input, isDefault });
      }
      router.back();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível salvar o endereço.");
    }
  }

  const fields: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    keyboardType?: "numeric" | "default";
    maxLength?: number;
    loading?: boolean;
  }[] = [
    { label: "Apelido (opcional)", icon: "bookmark-outline", value: label, onChangeText: setLabel, placeholder: "Casa, Trabalho..." },
    { label: "CEP", icon: "mail-outline", value: cep, onChangeText: handleCepChange, placeholder: "00000-000", keyboardType: "numeric", maxLength: 8, loading: cepLoading },
    { label: "Rua", icon: "location-outline", value: street, onChangeText: setStreet, placeholder: "Nome da rua" },
    { label: "Número", icon: "home-outline", value: number, onChangeText: setNumber, placeholder: "123", keyboardType: "numeric" },
    { label: "Complemento (opcional)", icon: "business-outline", value: complement, onChangeText: setComplement, placeholder: "Apto, bloco..." },
    { label: "Bairro", icon: "map-outline", value: neighborhood, onChangeText: setNeighborhood, placeholder: "Bairro" },
    { label: "Cidade", icon: "business-outline", value: city, onChangeText: setCity, placeholder: "Cidade" },
    { label: "UF", icon: "flag-outline", value: uf, onChangeText: (t) => setUf(t.toUpperCase()), placeholder: "TO", maxLength: 2 },
  ];

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
        {fields.map((field) => (
          <View key={field.label} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.field}>
              <Ionicons name={field.icon} size={18} color={theme.colors.mutedForeground} />
              <TextInput
                style={styles.fieldValue}
                value={field.value}
                onChangeText={field.onChangeText}
                placeholder={field.placeholder}
                placeholderTextColor={theme.colors.mutedForeground}
                keyboardType={field.keyboardType}
                maxLength={field.maxLength}
                autoCapitalize={field.keyboardType === "numeric" ? "none" : "words"}
              />
              {field.loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
            </View>
          </View>
        ))}

        {!isEditing && (
          <Pressable style={styles.defaultRow} onPress={() => setIsDefault((v) => !v)}>
            <View style={[styles.checkbox, !isDefault && styles.checkboxOff]}>
              {isDefault && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={styles.defaultText}>Definir como endereço padrão</Text>
          </Pressable>
        )}

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, { opacity: pressed || submitting ? 0.9 : 1 }]}
          onPress={handleSave}
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
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 6,
    marginBottom: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOff: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  defaultText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: "#9997bd",
  },
  error: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
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
