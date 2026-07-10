import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { initialsOf, moneyFromCents } from "@/lib/format";
import { useCreateReview, useMyReview, useOrder } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

const tags = ["Pontual", "Educado", "Ambiente organizado", "Pagamento em dia"];
const RATING_WORD = ["", "Ruim", "Regular", "Bom", "Ótimo", "Excelente"];

// Avaliação do prestador sobre o cliente (RF-G1, lado prestador).
export default function ProviderRating() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading } = useOrder(id);
  const { data: myReview, isLoading: loadingReview } = useMyReview(id);
  const createReview = useCreateReview();

  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleTag = (tag: string) =>
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  if (isLoading || loadingReview || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const clientName = order.client.name;
  const firstName = clientName.split(" ")[0];
  const alreadyReviewed = !!myReview;
  const shownStars = myReview?.rating ?? stars;

  const handleSubmit = async () => {
    setErrorMsg(null);
    const parts = [selectedTags.join(" · "), comment.trim()].filter(Boolean);
    try {
      await createReview.mutateAsync({
        orderId: id,
        input: { rating: stars, comment: parts.join(" — ") || undefined },
      });
      router.replace("/provider/(tabs)");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não foi possível enviar a avaliação.");
    }
  };

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
            initials={initialsOf(clientName)}
            color={theme.colors.primary}
            size={64}
            radius={20}
            fontSize={21}
          />
          <Text style={styles.ratingQuestion}>Como foi com {firstName}?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => !alreadyReviewed && setStars(value)}
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
              <View style={styles.tagsRow}>
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.tag, active && styles.tagActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.commentBox}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Deixe um comentário (opcional)…"
                  placeholderTextColor={theme.colors.mutedForeground}
                  multiline
                  style={styles.commentInput}
                />
              </View>
            </>
          )}
        </View>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {alreadyReviewed ? (
          <Pressable
            style={({ pressed }) => [styles.submit, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.replace("/provider/(tabs)")}
          >
            <Text style={styles.submitText}>Voltar ao painel</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { opacity: pressed || createReview.isPending ? 0.9 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={createReview.isPending}
            >
              <Text style={styles.submitText}>
                {createReview.isPending ? "Enviando..." : "Enviar avaliação"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/provider/(tabs)")}>
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
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  tag: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagActive: {
    backgroundColor: "rgba(255,102,0,0.16)",
    borderColor: "rgba(255,102,0,0.4)",
  },
  tagText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  tagTextActive: {
    color: "#FF9a52",
    fontFamily: fonts.bold,
  },
  commentBox: {
    alignSelf: "stretch",
    backgroundColor: "rgba(20,20,44,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    padding: 13,
    marginTop: 16,
  },
  commentInput: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: "#fff",
    minHeight: 48,
    textAlignVertical: "top",
  },
  errorText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
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
