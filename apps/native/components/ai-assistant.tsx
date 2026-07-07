import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useLLM, type ToolCall } from "react-native-executorch";

import { fonts } from "@/constants/fonts";
import { catalogApi, type Category, type ProviderListItem } from "@/lib/api";
import { initialsOf, priceFromCents } from "@/lib/format";
import { useCategories } from "@/lib/hooks";
import {
  AI_MODEL,
  buildSearchTool,
  buildSystemPrompt,
  resolveCategoryId,
  SEARCH_TOOL_NAME,
  type SearchArgs,
} from "@/lib/assistant";
import { Avatar } from "@/components/ui/avatar";

type DisplayMessage = { role: "user" | "assistant"; content: string };

export function AiAssistant() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useCategories();

  const llm = useLLM({ model: AI_MODEL });

  const [input, setInput] = useState("");
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const configuredRef = useRef(false);
  const categoriesRef = useRef<Category[]>(categories);
  categoriesRef.current = categories;

  // Executa a busca REAL no catálogo do Supabase e atualiza os cards.
  // Retorna também um resumo textual (usado como resultado da tool p/ o modelo).
  const searchByCategoryId = useCallback(
    async (categoryId: string, label: string): Promise<ProviderListItem[]> => {
      setSearching(true);
      setSearchLabel(label);
      try {
        const list = await catalogApi.providers(categoryId);
        setProviders(list);
        return list;
      } catch {
        setProviders([]);
        return [];
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  // Callback do function calling: o modelo pede a busca, nós devolvemos dados reais.
  const executeToolCallback = useCallback(
    async (call: ToolCall): Promise<string | null> => {
      if (call.toolName !== SEARCH_TOOL_NAME) return null;
      const args = (call.arguments ?? {}) as SearchArgs;
      const cats = categoriesRef.current;
      const categoryId = resolveCategoryId(cats, args.categoria ?? "");
      if (!categoryId) {
        return "Não encontrei essa categoria. Categorias válidas: " + cats.map((c) => c.slug).join(", ");
      }
      const label = cats.find((c) => c.id === categoryId)?.name ?? args.categoria;
      const list = await searchByCategoryId(categoryId, label);
      if (list.length === 0) return `Nenhum prestador de ${label} disponível no momento.`;
      const top = list
        .slice(0, 5)
        .map((p) => `${p.name} (nota ${p.rating.toFixed(1)}, a partir de ${priceFromCents(p.priceFromCents)})`)
        .join("; ");
      return `Encontrei ${list.length} prestador(es) de ${label}: ${top}. Os cards já foram mostrados ao usuário.`;
    },
    [searchByCategoryId],
  );

  // Configura chat + tools uma única vez, quando o modelo carrega e as categorias chegam.
  useEffect(() => {
    if (!llm.isReady || configuredRef.current || categories.length === 0) return;
    llm.configure({
      chatConfig: { systemPrompt: buildSystemPrompt(categories) },
      toolsConfig: {
        tools: [buildSearchTool(categories)],
        executeToolCallback,
        displayToolCalls: false,
      },
    });
    configuredRef.current = true;
  }, [llm, llm.isReady, categories, executeToolCallback]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || llm.isGenerating) return;
    setInput("");
    try {
      await llm.sendMessage(text);
    } catch {
      // erro de geração é refletido por llm.error abaixo
    }
  }, [input, llm]);

  // Fallback determinístico: toca numa categoria e busca direto, sem depender do modelo.
  const handleCategoryChip = useCallback(
    (category: Category) => {
      void searchByCategoryId(category.id, category.name);
    },
    [searchByCategoryId],
  );

  // --- Estado 1: carregando o modelo (download pode ser de centenas de MB) ---
  if (!llm.isReady) {
    const progress = Math.round((llm.downloadProgress ?? 0) * 100);
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingTitle}>Preparando o assistente…</Text>
        <Text style={styles.loadingSub}>
          {progress > 0 && progress < 100
            ? `Baixando o modelo local — ${progress}%`
            : "Carregando modelo no aparelho"}
        </Text>
        {llm.error ? (
          <Text style={styles.errorText}>{String(llm.error.message ?? llm.error)}</Text>
        ) : null}
      </View>
    );
  }

  // --- Estado 3: erro de carregamento ---
  if (llm.error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={30} color={theme.colors.destructive} />
        <Text style={styles.errorText}>{String(llm.error.message ?? llm.error)}</Text>
      </View>
    );
  }

  const history = llm.messageHistory.filter(
    (m): m is DisplayMessage => m.role === "user" || m.role === "assistant",
  );
  // Bolha viva com o texto em streaming enquanto o assistente ainda não foi anexado ao histórico.
  const streaming =
    llm.isGenerating && llm.response && history[history.length - 1]?.role !== "assistant"
      ? llm.response
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 8}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {history.length === 0 && !streaming ? (
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="sparkles" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.introTitle}>Como posso ajudar?</Text>
            <Text style={styles.introSub}>
              Descreva o que você precisa — ex.: “tem um vazamento na pia da cozinha” — que eu encontro
              os prestadores certos aqui em Palmas.
            </Text>
            <View style={styles.chipsRow}>
              {categories.map((c) => (
                <Pressable key={c.id} style={styles.chip} onPress={() => handleCategoryChip(c)}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {history.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={m.role === "user" ? styles.userText : styles.assistantText}>{m.content}</Text>
          </View>
        ))}

        {streaming ? (
          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={styles.assistantText}>{streaming}</Text>
          </View>
        ) : null}

        {llm.isGenerating && !streaming ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            <Text style={styles.typingText}>Pensando…</Text>
          </View>
        ) : null}

        {(searching || providers.length > 0) && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {searchLabel ? `Prestadores de ${searchLabel}` : "Prestadores"}
            </Text>
            {searching ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />
            ) : (
              providers.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.providerCard, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => router.push({ pathname: "/client/provider/[id]", params: { id: p.id } })}
                >
                  <Avatar initials={initialsOf(p.name)} color="#3a3a70" size={44} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName}>{p.name}</Text>
                    <Text style={styles.providerMeta}>
                      ★ {p.rating.toFixed(1)} · {p.reviews} aval. · a partir de {priceFromCents(p.priceFromCents)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedForeground} />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Descreva o serviço que você precisa…"
          placeholderTextColor={theme.colors.mutedForeground}
          editable={!llm.isGenerating}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <Pressable
          style={[styles.sendBtn, (llm.isGenerating || !input.trim()) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={llm.isGenerating || !input.trim()}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  loadingTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.destructive,
    textAlign: "center",
    marginTop: 10,
  },
  messages: { padding: 18, paddingBottom: 24, gap: 10 },
  intro: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 8 },
  introIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  introTitle: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: theme.colors.foreground,
    marginTop: 14,
  },
  introSub: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  chip: {
    backgroundColor: "rgba(28,28,58,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontFamily: fonts.semiBold, color: theme.colors.foreground },
  bubble: { maxWidth: "86%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  userBubble: { alignSelf: "flex-end", backgroundColor: theme.colors.primary },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(28,28,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userText: { fontSize: 14.5, fontFamily: fonts.medium, color: "#fff", lineHeight: 20 },
  assistantText: { fontSize: 14.5, fontFamily: fonts.medium, color: "#e8e8f5", lineHeight: 20 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  typingText: { fontSize: 13, fontFamily: fonts.medium, color: theme.colors.mutedForeground },
  results: { marginTop: 6, gap: 10 },
  resultsTitle: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  providerName: { fontSize: 15, fontFamily: fonts.bold, color: theme.colors.foreground },
  providerMeta: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(13,13,36,0.97)",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    backgroundColor: "rgba(28,28,58,0.8)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(255,102,0,0.35)" },
}));
