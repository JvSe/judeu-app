import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { Screen } from "@/components/ui/screen";
import type { JobContractType } from "@/lib/api";
import { contractTypeLabel, moneyFromCents } from "@/lib/format";
import { useCategories, useJobs } from "@/lib/hooks";

// Espera o usuário parar de digitar antes de ir à rede (mesmo padrão da busca de prestadores).
const DEBOUNCE_MS = 300;

const CONTRACT_TYPE_OPTIONS: JobContractType[] = ["CLT", "PJ", "FREELANCE", "TEMPORARY"];

export default function BrowseJobs() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useCategories();

  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [contractType, setContractType] = useState<JobContractType | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: jobs = [], isLoading } = useJobs({
    q: term.trim() || undefined,
    categoryId,
    contractType,
  });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Vagas de emprego</Text>
        <Pressable onPress={() => router.push("/jobs/my-applications")} hitSlop={10}>
          <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchField}>
        <Ionicons name="search" size={18} color={theme.colors.primary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Cargo, empresa ou descrição"
          placeholderTextColor={theme.colors.mutedForeground}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.filterChip, categoryId === c.id && styles.filterChipActive]}
            onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
          >
            <Text style={[styles.filterChipText, categoryId === c.id && styles.filterChipTextActive]}>
              {c.name}
            </Text>
          </Pressable>
        ))}
        {CONTRACT_TYPE_OPTIONS.map((type) => (
          <Pressable
            key={type}
            style={[styles.filterChip, contractType === type && styles.filterChipActive]}
            onPress={() => setContractType(contractType === type ? undefined : type)}
          >
            <Text
              style={[styles.filterChipText, contractType === type && styles.filterChipTextActive]}
            >
              {contractTypeLabel(type)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />}
        {!isLoading && jobs.length === 0 && (
          <Text style={styles.emptyText}>Nenhuma vaga encontrada.</Text>
        )}
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: job.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{job.title}</Text>
              <Text style={styles.cardMeta}>
                {job.providerCompany.name} · {contractTypeLabel(job.contractType)}
              </Text>
              <Text style={styles.cardSalary}>
                {job.salaryCents != null ? moneyFromCents(job.salaryCents) : "Salário a combinar"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    marginHorizontal: 20,
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
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  filterChip: {
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: "#c9c7e4",
  },
  filterChipTextActive: {
    color: "#fff",
    fontFamily: fonts.bold,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginTop: 30,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: theme.colors.foreground,
  },
  cardMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 3,
  },
  cardSalary: {
    fontSize: 13.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    marginTop: 5,
  },
}));
