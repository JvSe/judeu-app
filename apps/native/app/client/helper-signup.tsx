import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { FormErrorText } from "@/components/form/error-text";
import { FormTextField } from "@/components/form/text-field";
import { Screen } from "@/components/ui/screen";
import { BottomSheet } from "@/components/ui/templates/bottom-sheet";
import type { BottomSheetMethods } from "@/components/ui/templates/bottom-sheet/types";
import { fonts } from "@/constants/fonts";
import { providerProfileApi } from "@/lib/api";
import { useAttendButtonVisibility } from "@/lib/attend-button";
import { useAuth } from "@/lib/auth-context";
import { formatPhone } from "@/lib/formatters/format-phone.helper";
import { readForegroundPosition } from "@/lib/location";
import { saveTokens } from "@/lib/tokens";

const TERMS = [
  "Ao ativar o modo de atender, você se oferece para ajudar pessoas perto de você em tarefas do dia a dia.",
  "As ajudas podem ser as mais variadas: buscar um documento, carregar uma caixa, acompanhar alguém ou resolver um imprevisto. Você escolhe qual pedido aceitar.",
  "Antes de aceitar, você vê o que a pessoa precisa, o valor e o bairro. O endereço completo só aparece depois do aceite.",
  "Seu nome fica visível para quem publicou o pedido. A descrição que você escreveu ajuda a pessoa a entender como você pode ajudar.",
  "O app usa sua localização enquanto o modo está ligado, só para mostrar pedidos perto de você. Você pode desligar o modo quando quiser.",
  "A pessoa que pediu a ajuda paga primeiro. Só então você inicia o caminho até o local combinado.",
  "Combine horário e detalhes pelo chat do pedido. Evite passar telefone ou dados desnecessários fora do app.",
  "Chegue no horário, avise se for atrasar e trate a outra pessoa com respeito. O Judeu pode encerrar o cadastro se houver denúncia.",
  "Este modo não coloca você no catálogo de prestadores profissionais. Ele serve apenas para atender pedidos abertos de ajuda.",
  "O valor mostrado no pedido é o que você recebe pela ajuda, já descontada a taxa do app.",
  "Você pode recusar um pedido, desligar o modo e voltar a usar o app só para pedir ajuda.",
  "Se você chegou ao fim deste texto, confirma que leu e aceita atender ajudas nessas condições.",
];

const schema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome"),
  phone: z.string().trim().min(8, "Informe um celular"),
  bio: z.string().trim().max(280, "Use no máximo 280 caracteres"),
  accepted: z.boolean().refine((v) => v === true, "Aceite para continuar"),
});

type FormValues = z.infer<typeof schema>;

const unformatPhone = (value: string) => value.replace(/\D/g, "");

export default function HelperSignup() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const attendButton = useAttendButtonVisibility();
  const termsRef = useRef<BottomSheetMethods>(null);
  const acceptedRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ? formatPhone(user.phone) : "",
      bio: "",
      accepted: false,
    },
  });
  const accepted = watch("accepted");

  const acceptTerms = useCallback(() => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    setValue("accepted", true, { shouldValidate: true });
    termsRef.current?.close();
  }, [setValue]);

  const onTermsScroll = useCallback(
    (y: number, height: number, contentHeight: number) => {
      if (height < 80 || contentHeight < height + 24) return;
      if (y + height < contentHeight - 28) return;
      acceptTerms();
    },
    [acceptTerms],
  );

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === "granted") {
        const pos = await readForegroundPosition();
        lat = pos?.lat;
        lng = pos?.lng;
      }

      const res = await providerProfileApi.registerHelper({
        fullName: data.fullName,
        phone: unformatPhone(data.phone),
        bio: data.bio || undefined,
        acceptedTerms: true,
        lat,
        lng,
      });
      await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      updateUser(res.user);
      queryClient.setQueryData(["provider-profile", "me"], res.profile);

      if (lat == null || lng == null) {
        Alert.alert(
          "Localização",
          "Precisamos saber onde você está para achar pedidos perto.",
        );
        router.replace("/client");
        return;
      }

      await providerProfileApi.updateLocation(lat, lng);
      const profile = await providerProfileApi.setAvailability(true);
      queryClient.setQueryData(["provider-profile", "me"], profile);
      router.replace("/client");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível concluir o cadastro");
    } finally {
      setSubmitting(false);
    }
  });

  const toggleAttendButton = () => {
    void (attendButton.hidden ? attendButton.show() : attendButton.hide()).catch(() =>
      setSubmitError("Não foi possível salvar essa preferência."),
    );
  };

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} disabled={submitting}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.step}>Atender ajudas</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Quero atender</Text>
        <Text style={styles.subtitle}>
          Confirme seu nome e celular. As ajudas podem ser de qualquer tipo. Você escolhe quando ligar o modo.
        </Text>

        <FormTextField
          control={control}
          name="fullName"
          label="Seu nome"
          icon="person-outline"
          placeholder="Como as pessoas te chamam"
          autoComplete="name"
          editable={!submitting}
        />
        <FormTextField
          control={control}
          name="phone"
          label="Celular"
          icon="phone-portrait-outline"
          placeholder="(11) 90000-0000"
          keyboardType="phone-pad"
          autoComplete="tel"
          formatValue={formatPhone}
          parseValue={unformatPhone}
          editable={!submitting}
        />
        <FormTextField
          control={control}
          name="bio"
          label="Como você pode ajudar (opcional)"
          icon="chatbubble-outline"
          placeholder="Ex.: carrego caixa, busco documento..."
          editable={!submitting}
        />

        <Pressable
          style={styles.termsRow}
          onPress={() => termsRef.current?.snapToIndex(0)}
          disabled={submitting}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
            {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={styles.termsCopy}>
            <Text style={styles.termsText}>
              Entendi que vou atender pedidos de outras pessoas e aceito os termos para isso.
            </Text>
            {!accepted && <Text style={styles.termsHint}>Toque para ler. O aceite vale no final do texto.</Text>}
          </View>
        </Pressable>

        <Pressable style={styles.hideBtn} onPress={toggleAttendButton} disabled={!attendButton.ready}>
          <Text style={styles.hideText}>
            {attendButton.hidden ? "Mostrar botão no mapa" : "Ocultar botão"}
          </Text>
        </Pressable>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            { opacity: !accepted ? 0.4 : pressed || submitting ? 0.9 : 1 },
          ]}
          onPress={() => void onValid()}
          disabled={!accepted || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Começar a atender</Text>
          )}
        </Pressable>
      </View>

      <BottomSheet
        ref={termsRef}
        snapPoints={["82%"]}
        backgroundColor={theme.colors.background}
        onContentScroll={onTermsScroll}
        contentContainerStyle={styles.termsSheet}
      >
        <Text style={styles.termsTitle}>Termos para atender</Text>
        <Text style={styles.termsLead}>Role até o final para aceitar.</Text>
        {TERMS.map((paragraph) => (
          <Text key={paragraph} style={styles.termsParagraph}>
            {paragraph}
          </Text>
        ))}
        <View style={styles.termsEnd} />
      </BottomSheet>
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
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
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
  termsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    marginTop: 1,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  termsCopy: { flex: 1 },
  termsText: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    lineHeight: 19,
  },
  termsHint: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.primary,
  },
  hideBtn: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingVertical: 6,
  },
  hideText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: theme.colors.mutedForeground,
  },
  submitError: { marginTop: 12 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  submit: {
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  termsSheet: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 36,
  },
  termsTitle: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  termsLead: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.primary,
  },
  termsParagraph: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: theme.colors.foreground,
    lineHeight: 22,
    marginBottom: 16,
  },
  termsEnd: {
    height: 36,
  },
}));
