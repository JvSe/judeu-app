import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import type { Category, ProviderListItem } from "@/lib/api";
import { avatarColor, initialsOf, priceFromCents } from "@/lib/format";
import { useCatalogSearch, useCategories } from "@/lib/hooks";

// Espera o usuário parar de digitar antes de ir à rede.
const DEBOUNCE_MS = 300;

export default function Explore() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [], isLoading } = useCategories();

  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching, isError, refetch } = useCatalogSearch(term);
  const searching = term.trim().length >= 2;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.heading}>O que você{"\n"}precisa resolver?</Text>

        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={theme.colors.primary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Empresas, prestadores ou serviços"
            placeholderTextColor={theme.colors.mutedForeground}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {searching ? (
          <SearchResults
            loading={isFetching}
            failed={isError}
            onRetry={refetch}
            categories={results?.categories ?? []}
            providers={results?.providers ?? []}
            term={term.trim()}
            onPickCategory={setQuery}
          />
        ) : isLoading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={{ marginTop: 24 }}
          />
        ) : (
          <View style={styles.grid}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={({ pressed }) => [
                  styles.categoryCard,
                  category.featured && styles.categoryCardFeatured,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => setQuery(category.name)}
              >
                <Ionicons
                  name={
                    (category.icon ?? "pricetag") as React.ComponentProps<
                      typeof Ionicons
                    >["name"]
                  }
                  size={28}
                  color={category.featured ? "#fff" : theme.colors.primary}
                />
                <View>
                  <Text
                    style={[
                      styles.categoryName,
                      category.featured && styles.categoryNameFeatured,
                    ]}
                  >
                    {category.name}
                  </Text>
                  <Text
                    style={[
                      styles.categoryCount,
                      category.featured && styles.categoryCountFeatured,
                    ]}
                  >
                    {category.count}{" "}
                    {category.count === 1 ? "prestador" : "prestadores"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

type SearchResultsProps = {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  categories: Category[];
  providers: ProviderListItem[];
  term: string;
  onPickCategory: (name: string) => void;
};

function SearchResults({
  loading,
  failed,
  onRetry,
  categories,
  providers,
  term,
  onPickCategory,
}: SearchResultsProps) {
  const { theme } = useUnistyles();

  if (loading && categories.length === 0 && providers.length === 0) {
    return (
      <ActivityIndicator
        color={theme.colors.primary}
        style={{ marginTop: 24 }}
      />
    );
  }

  // Falha de rede/servidor não pode se passar por "nada encontrado".
  if (failed) {
    return (
      <View style={styles.feedback}>
        <Text style={styles.empty}>Não consegui buscar agora.</Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (categories.length === 0 && providers.length === 0) {
    return <Text style={styles.empty}>Nada encontrado para “{term}”.</Text>;
  }

  return (
    <View style={{ gap: 22 }}>
      {categories.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <View style={styles.chipsRow}>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                style={styles.chip}
                onPress={() => onPickCategory(c.name)}
              >
                <Text style={styles.chipText}>{c.name}</Text>
                <Text style={styles.chipCount}>{c.count}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {providers.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Empresas e prestadores</Text>
          <View style={{ gap: 10 }}>
            {providers.map((p, index) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.providerCard,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/client/provider/[id]",
                    params: { id: p.id },
                  })
                }
              >
                <Avatar
                  initials={initialsOf(p.name)}
                  color={avatarColor(index)}
                  size={44}
                  radius={14}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.providerMeta} numberOfLines={1}>
                    {p.companyName ? `${p.companyName} · ` : ""}
                    {p.role ?? "Prestador"}
                  </Text>
                  <Text style={styles.providerMeta}>
                    ★ {p.rating.toFixed(1)} · {p.reviews} aval.
                    {p.priceFromCents != null
                      ? ` · a partir de ${priceFromCents(p.priceFromCents)}`
                      : ""}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  eyebrow: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontFamily: fonts.semiBold,
  },
  heading: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 4,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    marginTop: 16,
    paddingHorizontal: 15,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: theme.colors.foreground,
    padding: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
  },
  empty: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: 28,
  },
  feedback: {
    alignItems: "center",
    gap: 14,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 11,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: theme.colors.foreground,
  },
  chipCount: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: theme.colors.primary,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.7)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
  },
  providerName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  providerMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
  },
  categoryCard: {
    width: "47%",
    height: 130,
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xxl,
    padding: 18,
    justifyContent: "space-between",
  },
  categoryCardFeatured: {
    backgroundColor: theme.colors.primary,
    borderWidth: 0,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  categoryName: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  categoryNameFeatured: {
    color: "#fff",
  },
  categoryCount: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
  },
  categoryCountFeatured: {
    color: "rgba(255,255,255,0.85)",
  },
}));
