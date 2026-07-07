import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { moneyFromCents } from "@/lib/format";
import { useCreateOrder } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

export default function CreateOrder() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    providerId: string;
    providerName?: string;
    serviceId?: string;
    serviceName?: string;
    priceCents?: string;
  }>();

  const [when, setWhen] = useState<"agora" | "agendar">("agora");
  const [description, setDescription] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Palmas");
  const [uf, setUf] = useState("TO");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const priceCents = params.priceCents ? Number(params.priceCents) : 0;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!params.providerId) {
      setErrorMsg("Prestador não informado.");
      return;
    }
    if (!street.trim() || !city.trim() || !uf.trim()) {
      setErrorMsg("Preencha o endereço (rua, cidade e estado).");
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        providerId: params.providerId,
        serviceId: params.serviceId,
        description: description.trim() || undefined,
        address: {
          label: "Casa",
          street: street.trim(),
          number: number.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim(),
          state: uf.trim(),
        },
      });
      router.replace({ pathname: "/client/payment/[id]", params: { id: order.id } });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Novo pedido</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Serviço</Text>
        <View style={styles.serviceCard}>
          <View style={styles.serviceIcon}>
            <Ionicons name="flash" size={21} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceName}>{params.providerName ?? "Prestador"}</Text>
            <Text style={styles.serviceSub}>{params.serviceName ?? "Serviço a combinar"}</Text>
          </View>
          {priceCents > 0 && <Text style={styles.servicePrice}>{moneyFromCents(priceCents)}</Text>}
        </View>

        <Text style={styles.label}>Descreva o problema</Text>
        <View style={styles.textArea}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex.: preciso instalar 2 tomadas novas na cozinha."
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
            style={styles.textAreaInput}
          />
        </View>

        <Text style={styles.label}>Quando?</Text>
        <View style={styles.whenRow}>
          <Pressable
            style={[styles.whenButton, when === "agora" && styles.whenButtonActive]}
            onPress={() => setWhen("agora")}
          >
            <Text style={[styles.whenText, when === "agora" && styles.whenTextActive]}>Agora</Text>
          </Pressable>
          <Pressable
            style={[styles.whenButton, when === "agendar" && styles.whenButtonActive]}
            onPress={() => setWhen("agendar")}
          >
            <Text style={[styles.whenText, when === "agendar" && styles.whenTextActive]}>
              Agendar
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Endereço</Text>
        <View style={{ gap: 10 }}>
          <TextInput
            value={street}
            onChangeText={setStreet}
            placeholder="Rua / Avenida"
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.input}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              value={number}
              onChangeText={setNumber}
              placeholder="Número"
              placeholderTextColor={theme.colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="Bairro"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[styles.input, { flex: 2 }]}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Cidade"
              placeholderTextColor={theme.colors.mutedForeground}
              style={[styles.input, { flex: 2 }]}
            />
            <TextInput
              value={uf}
              onChangeText={setUf}
              placeholder="UF"
              placeholderTextColor={theme.colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={2}
              style={[styles.input, { flex: 1 }]}
            />
          </View>
        </View>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {priceCents > 0 && (
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Valor do serviço</Text>
            <Text style={styles.estimateValue}>{moneyFromCents(priceCents)}</Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: pressed || createOrder.isPending ? 0.9 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={createOrder.isPending}
        >
          <Text style={styles.submitText}>
            {createOrder.isPending ? "Enviando..." : "Enviar pedido"}
          </Text>
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
  headerTitle: {
    fontSize: 19,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 160,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
    marginBottom: 9,
    marginTop: 4,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 17,
    padding: 14,
    marginBottom: 20,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "rgba(255,102,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: {
    fontSize: 15.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  serviceSub: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  servicePrice: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  textArea: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
  },
  textAreaInput: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
    lineHeight: 22,
    minHeight: 66,
    textAlignVertical: "top",
  },
  input: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
  },
  whenRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  whenButton: {
    flex: 1,
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  whenButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  whenText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  whenTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  errorText: {
    marginTop: 14,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,15,38,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  estimateLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  estimateValue: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#fff",
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
