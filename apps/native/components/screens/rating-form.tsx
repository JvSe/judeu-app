import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { z } from "zod";

import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents } from "@/lib/format";
import { useCreateReview, useMyReview, useOrder } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { FormChipSelect } from "@/components/form/chip-select";
import { FormErrorText } from "@/components/form/error-text";
import { FormInput } from "@/components/form/input";
import { Screen } from "@/components/ui/screen";

const RATING_WORD = ["", "Ruim", "Regular", "Bom", "Ótimo", "Excelente"];

const ROLE_CONFIG: Record<
  "client" | "provider",
  { tags: string[]; question: (firstName: string) => string; homeRoute: string; backLabel: string }
> = {
  client: {
    tags: ["Pontual", "Caprichoso", "Educado", "Preço justo"],
    question: (firstName) => `Como foi com o ${firstName}?`,
    homeRoute: "/client/orders",
    backLabel: "Voltar aos pedidos",
  },
  provider: {
    tags: ["Pontual", "Educado", "Ambiente organizado", "Pagamento em dia"],
    question: (firstName) => `Como foi com ${firstName}?`,
    homeRoute: "/provider/(tabs)",
    backLabel: "Voltar ao painel",
  },
};

const ratingSchema = z.object({
  stars: z.number(),
  tags: z.array(z.string()),
  comment: z.string(),
});

type RatingForm = z.infer<typeof ratingSchema>;

// Avaliação pós-serviço (RF-G1) — compartilhada entre cliente e prestador, cada
// um avaliando o outro lado do pedido concluído. `role` decide de quem é a tela.
export function RatingForm({ role }: { role: "client" | "provider" }) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tags, question, homeRoute, backLabel } = ROLE_CONFIG[role];

  const { data: order, isLoading } = useOrder(id);
  const { data: myReview, isLoading: loadingReview } = useMyReview(id);
  const createReview = useCreateReview();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<RatingForm>({
    resolver: zodResolver(ratingSchema),
    defaultValues: { stars: 5, tags: [], comment: "" },
  });
  const { field: starsField } = useController({ control, name: "stars" });

  if (isLoading || loadingReview || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const counterpartName = role === "client" ? (order.provider?.name ?? "prestador") : order.client.name;
  const firstName = counterpartName.split(" ")[0];
  const alreadyReviewed = !!myReview;
  const shownStars = myReview?.rating ?? starsField.value;

  const onValid = handleSubmit(async (data) => {
    setSubmitError(null);
    // Junta as tags selecionadas ao comentário livre.
    const parts = [data.tags.join(" · "), data.comment.trim()].filter(Boolean);
    try {
      await createReview.mutateAsync({
        orderId: id,
        input: { rating: data.stars, comment: parts.join(" — ") || undefined },
      });
      router.replace(homeRoute as never);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar a avaliação.");
    }
  });

  return (
    <Screen>
      <View style={styles.glow} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.successHeader}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={32} color={theme.colors.success} />
          </View>
          <Text style={styles.successTitle}>Serviço concluído!</Text>
          <Text style={styles.successSub}>
            {order.service?.name ?? "Serviço"} · {moneyFromCents(order.totalCents)}
          </Text>
        </View>

        <View style={styles.ratingCard}>
          <Avatar
            initials={initialsOf(counterpartName)}
            color={theme.colors.primary}
            size={64}
            radius={20}
            fontSize={21}
          />
          <Text style={styles.ratingQuestion}>{question(firstName)}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => !alreadyReviewed && starsField.onChange(value)}
                hitSlop={6}
                disabled={alreadyReviewed}
              >
                <Ionicons
                  name={value <= shownStars ? "star" : "star-outline"}
                  size={38}
                  color="#FF9a2e"
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingWord}>{RATING_WORD[shownStars]}</Text>

          {alreadyReviewed ? (
            <>
              {myReview?.comment && <Text style={styles.reviewComment}>“{myReview.comment}”</Text>}
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={styles.doneBadgeText}>Avaliação enviada</Text>
              </View>
            </>
          ) : (
            <>
              <FormChipSelect
                control={control}
                name="tags"
                multiple
                options={tags.map((t) => ({ value: t, label: t }))}
                containerStyle={styles.tagsSpacing}
                rowStyle={styles.tagsRow}
              />

              <FormInput
                control={control}
                name="comment"
                placeholder="Deixe um comentário (opcional)…"
                multiline
                containerStyle={styles.commentSpacing}
                boxStyle={styles.commentBox}
                inputStyle={styles.commentInput}
              />
            </>
          )}
        </View>

        {submitError && <FormErrorText style={styles.submitError}>{submitError}</FormErrorText>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {alreadyReviewed ? (
          <Pressable
            style={({ pressed }) => [styles.submit, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.replace(homeRoute as never)}
          >
            <Text style={styles.submitText}>{backLabel}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { opacity: pressed || createReview.isPending ? 0.9 : 1 },
              ]}
              onPress={onValid}
              disabled={createReview.isPending}
            >
              <Text style={styles.submitText}>
                {createReview.isPending ? "Enviando..." : "Enviar avaliação"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.replace(homeRoute as never)}>
              <Text style={styles.skip}>Pular</Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  glow: {
    position: "absolute",
    top: -70,
    left: "50%",
    width: 380,
    height: 380,
    borderRadius: 190,
    marginLeft: -190,
    backgroundColor: "rgba(49,208,127,0.14)",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 160,
  },
  successHeader: {
    alignItems: "center",
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(49,208,127,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(49,208,127,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
    marginTop: 18,
  },
  successSub: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#9997bd",
    marginTop: 7,
  },
  ratingCard: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    marginTop: 28,
  },
  ratingQuestion: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: "#fff",
    marginTop: 12,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  ratingWord: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: "#FF9a2e",
    marginTop: 9,
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#c9c7e4",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 14,
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(49,208,127,0.14)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 18,
  },
  doneBadgeText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: theme.colors.success,
  },
  tagsSpacing: {
    marginTop: 16,
  },
  tagsRow: {
    justifyContent: "center",
  },
  commentSpacing: {
    alignSelf: "stretch",
    marginTop: 16,
  },
  commentBox: {
    backgroundColor: "rgba(20,20,44,0.8)",
    borderColor: theme.colors.border,
    borderRadius: 15,
    padding: 13,
  },
  commentInput: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    minHeight: 48,
    lineHeight: undefined,
  },
  submitError: {
    marginTop: 16,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: "rgba(13,13,36,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
  skip: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: theme.colors.mutedForeground,
  },
}));
