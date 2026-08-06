import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useController, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { moneyFromCents } from "@/lib/format";
import { formatBirthday } from "@/lib/formatters/format-birthday.helper";
import { formatTime } from "@/lib/formatters/format-time.helper";
import { useAddresses, useCreateOrder } from "@/lib/hooks";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import { Screen } from "@/components/ui/screen";

// Combina "DD/MM/AAAA" + "HH:MM" num Date local; null se incompleto/inválido.
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

const createOrderSchema = z
  .object({
    when: z.enum(["agora", "agendar"]),
    scheduleDate: z.string(),
    scheduleTime: z.string(),
    description: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.when !== "agendar") return;
    const parsed = parseScheduledAt(val.scheduleDate, val.scheduleTime);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduleDate"],
        message: "Informe uma data e hora válidas para o agendamento.",
      });
    } else if (parsed.getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduleTime"],
        message: "Escolha uma data e hora no futuro.",
      });
    }
  });

type CreateOrderForm = z.infer<typeof createOrderSchema>;

export default function CreateOrder() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    providerId: string;
    providerName?: string;
    serviceId?: string;
    serviceName?: string;
    priceCents?: string;
    allowsNegotiation?: string;
  }>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const { data: addresses, isLoading: addressesLoading } = useAddresses();

  // Seleciona o endereço padrão automaticamente quando a lista chega (ou se o
  // endereço selecionado deixou de existir, ex.: acabou de ser removido).
  useEffect(() => {
    if (!addresses?.length) return;
    setSelectedAddressId((current) => {
      if (current && addresses.some((a) => a.id === current)) return current;
      return addresses.find((a) => a.isDefault)?.id ?? addresses[0].id;
    });
  }, [addresses]);

  const { control, handleSubmit } = useForm<CreateOrderForm>({
    resolver: zodResolver(createOrderSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      when: "agora",
      scheduleDate: "",
      scheduleTime: "",
      description: "",
    },
  });
  const { field: whenField } = useController({ control, name: "when" });

  const createOrder = useCreateOrder();
  const priceCents = params.priceCents ? Number(params.priceCents) : 0;

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    if (!params.providerId) {
      setSubmitError("Prestador não informado.");
      return;
    }
    const selectedAddress = addresses?.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) {
      setSubmitError("Selecione um endereço para continuar.");
      return;
    }
    let scheduledAt: string | undefined;
    if (data.when === "agendar") {
      const parsed = parseScheduledAt(data.scheduleDate, data.scheduleTime);
      if (parsed) scheduledAt = parsed.toISOString();
    }
    try {
      const order = await createOrder.mutateAsync({
        providerId: params.providerId,
        serviceId: params.serviceId,
        description: data.description.trim() || undefined,
        scheduledAt,
        addressId: selectedAddress.id,
      });
      if (params.allowsNegotiation === "true") {
        // Prestador habilitou negociação (RF-D5) — vai pro detalhe do pedido em vez de
        // pular direto pro pagamento, pra dar espaço a propor/receber um valor diferente.
        router.replace({ pathname: "/client/order/[id]", params: { id: order.id } });
      } else {
        router.replace({ pathname: "/client/payment/[id]", params: { id: order.id } });
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    }
  });

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
        <FormInput
          control={control}
          name="description"
          placeholder="Ex.: preciso instalar 2 tomadas novas na cozinha."
          multiline
          containerStyle={styles.textAreaSpacing}
        />

        <Text style={styles.label}>Quando?</Text>
        <View style={styles.whenRow}>
          <Pressable
            style={[styles.whenButton, whenField.value === "agora" && styles.whenButtonActive]}
            onPress={() => whenField.onChange("agora")}
          >
            <Text style={[styles.whenText, whenField.value === "agora" && styles.whenTextActive]}>
              Agora
            </Text>
          </Pressable>
          <Pressable
            style={[styles.whenButton, whenField.value === "agendar" && styles.whenButtonActive]}
            onPress={() => whenField.onChange("agendar")}
          >
            <Text style={[styles.whenText, whenField.value === "agendar" && styles.whenTextActive]}>
              Agendar
            </Text>
          </Pressable>
        </View>

        {whenField.value === "agendar" && (
          <View style={styles.scheduleRow}>
            <FormInput
              control={control}
              name="scheduleDate"
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              parseValue={formatBirthday}
              containerStyle={{ flex: 3 }}
            />
            <FormInput
              control={control}
              name="scheduleTime"
              placeholder="HH:MM"
              keyboardType="number-pad"
              maxLength={5}
              parseValue={formatTime}
              containerStyle={{ flex: 2 }}
            />
          </View>
        )}

        <Text style={styles.label}>Endereço</Text>
        {addressesLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={styles.addressLoading} />
        ) : addresses && addresses.length > 0 ? (
          <View style={{ gap: 10 }}>
            {addresses.map((address) => {
              const selected = address.id === selectedAddressId;
              return (
                <Pressable
                  key={address.id}
                  style={[styles.addressCard, selected && styles.addressCardActive]}
                  onPress={() => setSelectedAddressId(address.id)}
                >
                  <View style={[styles.addressRadio, selected && styles.addressRadioActive]}>
                    {selected && <View style={styles.addressRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.addressTitleRow}>
                      <Text style={styles.addressLabel}>{address.label || "Endereço"}</Text>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Padrão</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressDetail} numberOfLines={2}>
                      {address.street}
                      {address.number ? `, ${address.number}` : ""} — {address.city}/{address.state}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.addressEmpty}>Você ainda não tem endereços cadastrados.</Text>
        )}

        <Pressable
          style={styles.addAddressButton}
          onPress={() => router.push("/client/address-form" as never)}
        >
          <Ionicons name="add" size={18} color={theme.colors.primary} />
          <Text style={styles.addAddressButtonText}>Adicionar novo endereço</Text>
        </Pressable>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
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
          onPress={onValid}
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
  textAreaSpacing: {
    marginBottom: 12,
  },
  addressLoading: {
    marginVertical: 10,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "rgba(28,28,58,0.6)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
  },
  addressCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(28,28,58,0.85)",
  },
  addressRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  addressRadioActive: {
    borderColor: theme.colors.primary,
  },
  addressRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressLabel: {
    fontSize: 14.5,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  defaultBadge: {
    backgroundColor: "rgba(255,102,0,0.16)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  addressDetail: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
  },
  addressEmpty: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  addAddressButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
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
  scheduleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  submitError: {
    marginTop: 14,
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
