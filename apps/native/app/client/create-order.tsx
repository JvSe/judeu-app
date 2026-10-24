import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { formatAddressLine, moneyFromCents } from "@/lib/format";
import { useAddresses, useCreateOrder, useProvider } from "@/lib/hooks";
import { Screen } from "@/components/ui/screen";

function parseScheduledAt(date: string, time: string): Date | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, dd, mm, yyyy] = dateMatch;
  const [, hh, min] = timeMatch;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  const valid =
    parsed.getFullYear() === Number(yyyy) &&
    parsed.getMonth() === Number(mm) - 1 &&
    parsed.getDate() === Number(dd) &&
    parsed.getHours() === Number(hh) &&
    parsed.getMinutes() === Number(min);
  return valid ? parsed : null;
}

export default function ConfirmCall() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    providerId?: string;
    providerName?: string;
    serviceId?: string;
    serviceName?: string;
    priceCents?: string;
    allowsNegotiation?: string;
    categoryId?: string;
    description?: string;
  }>();

  const isOpenRequest = !params.providerId;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(params.serviceId ?? null);
  const [when, setWhen] = useState<"agora" | "agendar">("agora");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [note, setNote] = useState(params.description ?? "");
  const [offerReais, setOfferReais] = useState(() => {
    if (!params.priceCents) return "";
    const cents = Number(params.priceCents);
    if (!Number.isFinite(cents) || cents <= 0) return "";
    return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2).replace(".", ",");
  });

  const { data: addresses, isLoading: addressesLoading } = useAddresses();
  const { data: provider, isLoading: providerLoading } = useProvider(params.providerId ?? "");
  const services = provider?.services;
  const createOrder = useCreateOrder();

  useEffect(() => {
    if (isOpenRequest || !addresses?.length) return;
    setSelectedAddressId((current) => {
      if (current && addresses.some((a) => a.id === current)) return current;
      return addresses.find((a) => a.isDefault)?.id ?? addresses[0].id;
    });
  }, [addresses, isOpenRequest]);

  useEffect(() => {
    if (isOpenRequest || !services?.length) return;
    setSelectedServiceId((current) => {
      if (current && services.some((s) => s.id === current)) return current;
      return services[0].id;
    });
  }, [isOpenRequest, services]);

  const selectedService = services?.find((s) => s.id === selectedServiceId);
  const offeredCents = offerReais
    ? Math.round(Number(offerReais.replace(",", ".")) * 100)
    : 0;
  const priceCents = isOpenRequest
    ? Number.isFinite(offeredCents)
      ? offeredCents
      : 0
    : (selectedService?.priceCents ?? (params.priceCents ? Number(params.priceCents) : 0));
  const feeCents = Math.round(priceCents * 0.08);
  const totalCents = priceCents + feeCents;
  const providerName = provider?.name ?? params.providerName ?? "Pessoa";
  const selectedAddress = addresses?.find((a) => a.id === selectedAddressId);
  const scheduled = when === "agendar";
  const canNegotiate =
    scheduled && (provider?.allowsNegotiation || params.allowsNegotiation === "true");

  const onConfirm = async () => {
    setSubmitError(null);
    if (isOpenRequest) {
      if (note.trim().length < 8) {
        setSubmitError("Descreva o que você precisa (pelo menos uma frase).");
        return;
      }
      if (!Number.isFinite(offeredCents) || offeredCents < 100) {
        setSubmitError("Informe quanto você vai pagar.");
        return;
      }
      try {
        const order = await createOrder.mutateAsync({
          categoryId: params.categoryId,
          description: note.trim(),
          priceCents: offeredCents,
        });
        router.replace({ pathname: "/client/waiting/[id]", params: { id: order.id } } as never);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Não foi possível publicar.");
      }
      return;
    }

    if (!params.providerId) {
      setSubmitError("Pessoa não informada.");
      return;
    }
    if (!selectedAddress) {
      setSubmitError("Escolha um endereço.");
      return;
    }
    let scheduledAt: string | undefined;
    if (scheduled) {
      const parsed = parseScheduledAt(scheduleDate, scheduleTime);
      if (!parsed || parsed.getTime() <= Date.now()) {
        setSubmitError("Informe uma data e hora futuras.");
        return;
      }
      scheduledAt = parsed.toISOString();
    }
    try {
      const order = await createOrder.mutateAsync({
        providerId: params.providerId,
        serviceId: selectedService?.id ?? params.serviceId,
        categoryId: params.categoryId,
        description: note.trim() || undefined,
        scheduledAt,
        addressId: selectedAddress.id,
      });
      if (canNegotiate) {
        router.replace({ pathname: "/client/order/[id]", params: { id: order.id } });
        return;
      }
      router.replace({ pathname: "/client/waiting/[id]", params: { id: order.id } } as never);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar a chamada.");
    }
  };

  if (isOpenRequest) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Pedir ajuda</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.kicker}>SOLICITAÇÃO ABERTA</Text>
            <Text style={styles.name}>Descreva e publique</Text>
            <Text style={styles.muted}>
              Qualquer pessoa disponível pode atender. Locais e detalhes você combina depois do aceite.
            </Text>
          </View>

          <Text style={styles.label}>O que você precisa?</Text>
          <TextInput
            style={[styles.input, styles.note]}
            value={note}
            onChangeText={setNote}
            placeholder="Ex.: buscar documentos na copiadora e deixar no meu trabalho"
            placeholderTextColor={theme.colors.mutedForeground}
            multiline
          />

          <Text style={styles.label}>Quanto vai pagar?</Text>
          <TextInput
            style={styles.input}
            value={offerReais}
            onChangeText={setOfferReais}
            placeholder="Ex.: 30"
            placeholderTextColor={theme.colors.mutedForeground}
            keyboardType="decimal-pad"
          />

          <Pressable
            style={({ pressed }) => [styles.aiButton, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/client/ai/chat" as never)}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.aiButtonText}>Prefere explicar conversando?</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View>
            <Text style={styles.footerLabel}>Total com taxa</Text>
            <Text style={styles.footerPrice}>
              {priceCents >= 100 ? moneyFromCents(totalCents) : "—"}
            </Text>
          </View>
          <Pressable
            style={[styles.callButton, createOrder.isPending && { opacity: 0.7 }]}
            onPress={onConfirm}
            disabled={createOrder.isPending}
          >
            <Text style={styles.callButtonText}>
              {createOrder.isPending ? "Publicando..." : "Publicar"}
            </Text>
          </Pressable>
        </View>
        {submitError ? (
          <Text style={[styles.error, { bottom: insets.bottom + 88 }]}>{submitError}</Text>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Confirmar chamada</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.kicker}>CHAMAR</Text>
          <Text style={styles.name}>{providerName}</Text>
          {providerLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : services && services.length > 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              {services.map((service) => {
                const selected = service.id === selectedServiceId;
                return (
                  <Pressable
                    key={service.id}
                    style={[styles.choice, selected && styles.choiceOn]}
                    onPress={() => setSelectedServiceId(service.id)}
                  >
                    <Text style={styles.choiceLabel}>{service.name}</Text>
                    <Text style={styles.choicePrice}>{moneyFromCents(service.priceCents)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>Serviço a combinar</Text>
          )}
        </View>

        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput
          style={[styles.input, styles.note]}
          value={note}
          onChangeText={setNote}
          placeholder="Ex.: interfone 12, vazamento na pia"
          placeholderTextColor={theme.colors.mutedForeground}
          multiline
        />

        <Text style={styles.label}>Onde</Text>
        {addressesLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : !addresses?.length ? (
          <Pressable style={styles.choice} onPress={() => router.push("/client/address-form")}>
            <Text style={styles.choiceLabel}>Adicionar endereço</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            {addresses.map((address) => {
              const selected = address.id === selectedAddressId;
              return (
                <Pressable
                  key={address.id}
                  style={[styles.choice, selected && styles.choiceOn]}
                  onPress={() => setSelectedAddressId(address.id)}
                >
                  <Text style={styles.choiceLabel}>{formatAddressLine(address)}</Text>
                  <Text style={styles.muted}>
                    {address.street}
                    {address.number ? `, ${address.number}` : ""}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => router.push("/client/address-form")}>
              <Text style={styles.link}>Adicionar outro endereço</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Quando</Text>
        <View style={styles.whenRow}>
          <Pressable
            style={[styles.whenChip, when === "agora" && styles.whenChipOn]}
            onPress={() => setWhen("agora")}
          >
            <Text style={[styles.whenText, when === "agora" && styles.whenTextOn]}>Agora</Text>
          </Pressable>
          <Pressable
            style={[styles.whenChip, scheduled && styles.whenChipOn]}
            onPress={() => setWhen("agendar")}
          >
            <Text style={[styles.whenText, scheduled && styles.whenTextOn]}>Agendar</Text>
          </Pressable>
        </View>
        {scheduled && (
          <View style={styles.whenRow}>
            <TextInput
              style={styles.input}
              value={scheduleDate}
              onChangeText={setScheduleDate}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={theme.colors.mutedForeground}
            />
            <TextInput
              style={styles.input}
              value={scheduleTime}
              onChangeText={setScheduleTime}
              placeholder="HH:MM"
              placeholderTextColor={theme.colors.mutedForeground}
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View>
          <Text style={styles.footerLabel}>Total com taxa</Text>
          <Text style={styles.footerPrice}>{moneyFromCents(totalCents)}</Text>
        </View>
        <Pressable
          style={[styles.callButton, createOrder.isPending && { opacity: 0.7 }]}
          onPress={onConfirm}
          disabled={createOrder.isPending}
        >
          <Text style={styles.callButtonText}>
            {createOrder.isPending ? "Chamando..." : `Chamar ${providerName.split(" ")[0]}`}
          </Text>
        </Pressable>
      </View>
      {submitError ? (
        <Text style={[styles.error, { bottom: insets.bottom + 88 }]}>{submitError}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 8,
  },
  card: {
    backgroundColor: "rgba(28,28,58,0.92)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  name: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 4,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  choice: {
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 14,
  },
  choiceOn: {
    borderColor: theme.colors.primary,
  },
  choiceLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  choicePrice: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
  },
  muted: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  link: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
    marginTop: 4,
  },
  aiButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(255,102,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  aiButtonText: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  whenRow: {
    flexDirection: "row",
    gap: 10,
  },
  whenChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(28,28,58,0.7)",
  },
  whenChipOn: {
    backgroundColor: theme.colors.primary,
  },
  whenText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  whenTextOn: {
    color: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  note: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#14142e",
  },
  footerLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
  footerPrice: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: "#fff",
  },
  callButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  callButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  error: {
    position: "absolute",
    left: 16,
    right: 16,
    color: theme.colors.destructive,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
}));
