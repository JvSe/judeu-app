import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { previewOrderTotals } from "@/lib/fees";
import { formatAddressLine, moneyFromCents } from "@/lib/format";
import { ordersApi } from "@/lib/api";
import { availabilityLabel } from "@/lib/availability";
import {
  useAddresses,
  useAppConfig,
  useCreateOrder,
  useCreditBalance,
  useOpenRequestAvailability,
  useProvider,
  useSuggestedPrice,
} from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

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

/** ISO → campos "DD/MM/AAAA" e "HH:MM" no fuso do aparelho. */
function toScheduleFields(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
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
    riskLevel?: string;
  }>();
  const riskHint = params.riskLevel ? Number(params.riskLevel) : undefined;

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
  const appConfig = useAppConfig();
  // Cupom e crédito (Fase 6): o desconto sai da parte da plataforma.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [useCredits, setUseCredits] = useState(false);
  const { data: creditBalanceCents = 0 } = useCreditBalance();
  // Preferências de quem atende (pitch: idoso escolhe nota, experiência, só mulheres).
  const [prefRating, setPrefRating] = useState(false);
  const [prefExperienced, setPrefExperienced] = useState(false);
  const [prefWomen, setPrefWomen] = useState(false);
  const preferences = {
    minRating: prefRating ? 4.8 : null,
    minCompleted: prefExperienced ? 50 : null,
    gender: prefWomen ? ("F" as const) : null,
  };
  const hasPrefs = prefRating || prefExperienced || prefWomen;
  // Ajuda aberta sai no endereço padrão (mesma regra da API ao publicar).
  const openAddress = isOpenRequest
    ? (addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null)
    : null;
  const { data: availability } = useOpenRequestAvailability(
    openAddress ? { lat: openAddress.lat, lng: openAddress.lng } : null,
    params.categoryId,
    hasPrefs ? preferences : undefined,
  );
  const availabilityText = availability ? availabilityLabel(availability) : null;
  const areaOpen = (availability?.area?.status ?? "OPEN") === "OPEN";
  // Fora do horário da zona: só dá para agendar; já sugere a próxima abertura.
  const areaClosed = availability?.area?.status === "CLOSED";
  const nextOpenAt = availability?.area?.status === "CLOSED" ? availability.area.nextOpenAt : null;
  useEffect(() => {
    if (!areaClosed) return;
    setWhen("agendar");
    if (nextOpenAt) {
      const fields = toScheduleFields(nextOpenAt);
      setScheduleDate((current) => current || fields.date);
      setScheduleTime((current) => current || fields.time);
    }
  }, [areaClosed, nextOpenAt]);
  const { data: suggested } = useSuggestedPrice(params.categoryId, isOpenRequest);
  const suggestedReais = suggested ? String(Math.round(suggested.priceCents / 100)) : null;

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
  const { totalCents } = previewOrderTotals(priceCents, appConfig);
  const wantsDiscount = Boolean(appliedCoupon) || useCredits;
  const discountQuery = useQuery({
    queryKey: ["discount-preview", priceCents, params.categoryId ?? null, appliedCoupon, useCredits],
    queryFn: () =>
      ordersApi.discountPreview({
        priceCents,
        categoryId: params.categoryId,
        couponCode: appliedCoupon ?? undefined,
        useCredits,
      }),
    enabled: wantsDiscount && priceCents >= 100,
    retry: false,
  });
  const discount = wantsDiscount && discountQuery.data ? discountQuery.data : null;
  const discountError =
    wantsDiscount && discountQuery.error ? errorMessage(discountQuery.error, "Não foi possível aplicar o desconto.") : null;
  const payableCents = discount ? discount.totalCents : totalCents;
  // Cupom recusado não vai no pedido (a API recusaria o pedido inteiro).
  const discountInput = {
    ...(appliedCoupon && !discountError ? { couponCode: appliedCoupon } : {}),
    ...(useCredits ? { useCredits: true } : {}),
  };
  const totalLabel = appConfig.feePayer === "CLIENT" ? "Total com taxa" : "Total";
  const providerName = provider?.name ?? params.providerName ?? "Pessoa";
  const selectedAddress = addresses?.find((a) => a.id === selectedAddressId);
  const scheduled = when === "agendar";
  const canNegotiate =
    scheduled && (provider?.allowsNegotiation || params.allowsNegotiation === "true");

  /** Lê o agendamento; avisa e devolve ok=false se a data for inválida ou passada. */
  const readScheduledAt = (): { ok: true; value?: string } | { ok: false } => {
    if (!scheduled) return { ok: true };
    const parsed = parseScheduledAt(scheduleDate, scheduleTime);
    if (!parsed || parsed.getTime() <= Date.now()) {
      const message = "Informe uma data e hora futuras.";
      setSubmitError(message);
      toast.warning(message);
      return { ok: false };
    }
    return { ok: true, value: parsed.toISOString() };
  };

  const onConfirm = async () => {
    setSubmitError(null);
    if (isOpenRequest) {
      if (note.trim().length < 8) {
        const message = "Descreva o que você precisa (pelo menos uma frase).";
        setSubmitError(message);
        toast.warning(message);
        return;
      }
      if (!Number.isFinite(offeredCents) || offeredCents < 100) {
        const message = "Informe quanto você vai pagar.";
        setSubmitError(message);
        toast.warning(message);
        return;
      }
      const schedule = readScheduledAt();
      if (!schedule.ok) return;
      try {
        const order = await createOrder.mutateAsync({
          categoryId: params.categoryId,
          description: note.trim(),
          priceCents: offeredCents,
          scheduledAt: schedule.value,
          ...(hasPrefs ? { preferences } : {}),
          ...(riskHint ? { riskHint } : {}),
          ...discountInput,
        });
        toast.success(schedule.value ? "Pedido agendado" : "Pedido publicado");
        router.replace({ pathname: "/client/waiting/[id]", params: { id: order.id } } as never);
      } catch (e) {
        const message = errorMessage(e, "Não foi possível publicar.");
        setSubmitError(message);
        toast.error(message);
      }
      return;
    }

    if (!params.providerId) {
      const message = "Pessoa não informada.";
      setSubmitError(message);
      toast.error(message);
      return;
    }
    if (!selectedAddress) {
      const message = "Escolha um endereço.";
      setSubmitError(message);
      toast.warning(message);
      return;
    }
    const schedule = readScheduledAt();
    if (!schedule.ok) return;
    const scheduledAt = schedule.value;
    try {
      const order = await createOrder.mutateAsync({
        providerId: params.providerId,
        serviceId: selectedService?.id ?? params.serviceId,
        categoryId: params.categoryId,
        description: note.trim() || undefined,
        scheduledAt,
        addressId: selectedAddress.id,
        ...discountInput,
      });
      toast.success("Chamada enviada");
      if (canNegotiate) {
        router.replace({ pathname: "/client/order/[id]", params: { id: order.id } });
        return;
      }
      router.replace({ pathname: "/client/waiting/[id]", params: { id: order.id } } as never);
    } catch (e) {
      const message = errorMessage(e, "Não foi possível enviar a chamada.");
      setSubmitError(message);
      toast.error(message);
    }
  };

  const whenSection = (
    <>
      <Text style={styles.label}>Quando</Text>
      <View style={styles.whenRow}>
        <Pressable
          style={[styles.whenChip, when === "agora" && styles.whenChipOn, areaClosed && { opacity: 0.4 }]}
          onPress={() => !areaClosed && setWhen("agora")}
          disabled={areaClosed}
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
    </>
  );

  const discountSection = (
    <>
      <Text style={styles.label}>Cupom (opcional)</Text>
      <View style={styles.whenRow}>
        <TextInput
          style={styles.input}
          value={couponInput}
          onChangeText={(text) => {
            setCouponInput(text);
            if (appliedCoupon) setAppliedCoupon(null);
          }}
          placeholder="Código do cupom"
          placeholderTextColor={theme.colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable
          style={({ pressed }) => [styles.suggestion, { marginTop: 0, opacity: pressed ? 0.8 : 1 }]}
          onPress={() => setAppliedCoupon(couponInput.trim() ? couponInput.trim().toUpperCase() : null)}
        >
          <Text style={styles.suggestionText}>Aplicar</Text>
        </Pressable>
      </View>
      {creditBalanceCents > 0 && (
        <Pressable style={styles.prefRow} onPress={() => setUseCredits(!useCredits)}>
          <Ionicons
            name={useCredits ? "checkbox" : "square-outline"}
            size={20}
            color={useCredits ? theme.colors.primary : theme.colors.mutedForeground}
          />
          <Text style={styles.prefText}>Usar meus créditos ({moneyFromCents(creditBalanceCents)})</Text>
        </Pressable>
      )}
      {discountError ? (
        <Text style={[styles.muted, { color: theme.colors.destructive }]}>{discountError}</Text>
      ) : discount && discount.discountCents > 0 ? (
        <Text style={styles.muted}>
          {discount.couponLabel ? `${discount.couponLabel}. ` : ""}
          Desconto de {moneyFromCents(discount.discountCents)}
          {discount.creditCents > 0 ? ` (${moneyFromCents(discount.creditCents)} do seu crédito)` : ""}.
        </Text>
      ) : null}
    </>
  );

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

          {riskHint === 3 && (
            <View style={styles.availability}>
              <Ionicons name="construct-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.muted, { flex: 1, marginTop: 0 }]}>
                A JudIA entendeu que essa tarefa exige um profissional com credencial. Só quem
                tiver essa qualificação vai receber o pedido.
              </Text>
            </View>
          )}
          {riskHint === 2 && (
            <View style={styles.availability}>
              <Ionicons name="construct-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.muted, { flex: 1, marginTop: 0 }]}>
                Tarefa com ferramenta: vai para quem tem selo de reparos ou é profissional.
              </Text>
            </View>
          )}

          {availabilityText && (
            <View style={styles.availability}>
              <Ionicons
                name={availability!.count > 0 && areaOpen ? "people" : "time-outline"}
                size={18}
                color={
                  availability!.count > 0 && areaOpen ? theme.colors.primary : theme.colors.mutedForeground
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.availabilityTitle}>{availabilityText.title}</Text>
                <Text style={styles.muted}>{availabilityText.detail}</Text>
              </View>
            </View>
          )}

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
            placeholder={suggestedReais ? `Sugerido: ${suggestedReais}` : "Ex.: 30"}
            placeholderTextColor={theme.colors.mutedForeground}
            keyboardType="decimal-pad"
          />
          {suggested && offerReais !== suggestedReais && (
            <Pressable
              style={({ pressed }) => [styles.suggestion, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => setOfferReais(suggestedReais!)}
            >
              <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.suggestionText}>
                Sugerido: {moneyFromCents(suggested.priceCents)}
                {suggested.offHours ? " (fora do horário comercial)" : ""} · usar
              </Text>
            </Pressable>
          )}

          {whenSection}
          {discountSection}

          <Text style={styles.label}>Quem pode atender (opcional)</Text>
          {[
            { on: prefRating, set: setPrefRating, label: "Só com nota 4,8 ou mais" },
            { on: prefExperienced, set: setPrefExperienced, label: "Só com mais de 50 ajudas feitas" },
            { on: prefWomen, set: setPrefWomen, label: "Só mulheres" },
          ].map((p) => (
            <Pressable key={p.label} style={styles.prefRow} onPress={() => p.set(!p.on)}>
              <Ionicons
                name={p.on ? "checkbox" : "square-outline"}
                size={20}
                color={p.on ? theme.colors.primary : theme.colors.mutedForeground}
              />
              <Text style={styles.prefText}>{p.label}</Text>
            </Pressable>
          ))}
          {hasPrefs && (
            <Text style={styles.muted}>Com filtros, menos pessoas recebem o pedido e pode demorar mais.</Text>
          )}

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
            <Text style={styles.footerLabel}>{totalLabel}</Text>
            <Text style={styles.footerPrice}>
              {priceCents >= 100 ? moneyFromCents(payableCents) : "—"}
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

        {whenSection}
        {discountSection}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View>
          <Text style={styles.footerLabel}>{totalLabel}</Text>
          <Text style={styles.footerPrice}>{moneyFromCents(payableCents)}</Text>
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
  prefRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  prefText: { fontSize: 15, fontFamily: fonts.medium, color: "#fff" },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(28,28,58,0.7)",
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  availability: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 16,
    padding: 14,
  },
  availabilityTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
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
