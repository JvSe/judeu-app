import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { useLLM, type Message } from "react-native-executorch";

import { fonts } from "@/constants/fonts";
import { catalogApi, type Category, type ProviderListItem } from "@/lib/api";
import { initialsOf, priceFromCents } from "@/lib/format";
import { useCategories } from "@/lib/hooks";
import {
  AI_MODEL,
  buildSearchTool,
  buildSystemPrompt,
  parseToolCallArgs,
  resolveCategoryId,
  sanitizeReply,
  type SearchArgs,
} from "@/lib/assistant";
import { Avatar } from "@/components/ui/avatar";

type DisplayMessage = { role: "user" | "assistant"; content: string };

// Resultado da busca, retido até a resposta do modelo ficar pronta.
type SearchOutcome = {
  summary: string;
  label: string | null;
  providers: ProviderListItem[];
};

// Quantas mensagens da conversa acompanham cada geração. `generate` não aplica
// a janela deslizante que o `sendMessage` da lib usa, então limitamos aqui para
// a conversa não estourar o contexto do modelo.
const CONTEXT_MESSAGES = 12;

export function AiAssistant() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useCategories();

  const llm = useLLM({ model: AI_MODEL });

  const [input, setInput] = useState("");
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Cobre o turno inteiro. `llm.isGenerating` volta a false durante a busca na
  // rede, entre as duas gerações, e destravaria o input no meio do fluxo.
  const [busy, setBusy] = useState(false);
  // Transcrição própria: `generate` não mexe no messageHistory da lib, e é ele
  // que nos deixa fazer o segundo turno com o resultado da busca.
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const categoriesRef = useRef<Category[]>(categories);
  categoriesRef.current = categories;

  // Busca crua no catálogo REAL do Supabase. Não toca na tela — quem chama
  // decide a hora de publicar, para os cards não aparecerem antes da resposta.
  const fetchProviders = useCallback(async (categoryId: string): Promise<ProviderListItem[]> => {
    try {
      return await catalogApi.providers(categoryId);
    } catch {
      return [];
    }
  }, []);

  // Executa a busca e descreve o desfecho em uma frase factual. O `summary`
  // alimenta o segundo turno do modelo e vira o texto exibido se a geração
  // falhar; `label`/`providers` só vão para a tela depois da mensagem pronta.
  const runSearch = useCallback(
    async (args: SearchArgs): Promise<SearchOutcome> => {
      const cats = categoriesRef.current;
      const categoryId = resolveCategoryId(cats, args.categoria ?? "");
      if (!categoryId) {
        return {
          summary: `O Ajuda+ ainda não atende esse tipo de serviço. As categorias disponíveis são: ${cats
            .map((c) => c.name)
            .join(", ")}.`,
          label: null,
          providers: [],
        };
      }
      const label = cats.find((c) => c.id === categoryId)?.name ?? args.categoria;
      const list = await fetchProviders(categoryId);
      if (list.length === 0) {
        return {
          summary: `Nenhum prestador de ${label} está disponível no momento.`,
          label: null,
          providers: [],
        };
      }
      const top = list
        .slice(0, 5)
        .map((p) => `${p.name} (nota ${p.rating.toFixed(1)}, a partir de ${priceFromCents(p.priceFromCents)})`)
        .join("; ");
      return {
        summary: `${list.length} prestador(es) de ${label} encontrados: ${top}.`,
        label,
        providers: list,
      };
    },
    [fetchProviders],
  );

  // Contexto de cada geração: system prompt com as categorias reais + a conversa.
  const buildContext = useCallback(
    (history: DisplayMessage[]): Message[] => [
      { role: "system", content: buildSystemPrompt(categoriesRef.current) },
      ...history.slice(-CONTEXT_MESSAGES),
    ],
    [],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setSendError(null);
    setBusy(true);

    const withUser: DisplayMessage[] = [...messages, { role: "user", content: text }];
    setMessages(withUser);

    try {
      // 1º turno: o modelo conversa ou pede a busca.
      const raw = await llm.generate(buildContext(withUser), [
        buildSearchTool(categoriesRef.current),
      ]);
      const args = parseToolCallArgs(raw);

      if (!args) {
        const reply = sanitizeReply(raw);
        setMessages([
          ...withUser,
          {
            role: "assistant",
            content: reply || "Não entendi bem. Pode descrever o serviço que você precisa?",
          },
        ]);
        return;
      }

      // Uma busca nova começou: os cards da anterior saem de cena agora, e não
      // no meio da resposta.
      setProviders([]);
      setSearchLabel(null);

      // 2º turno: devolvemos o resultado real do catálogo e deixamos o modelo
      // redigir a resposta. Sem tools aqui, para ele não buscar de novo.
      const outcome = await runSearch(args);
      const followUp = await llm.generate([
        ...buildContext(withUser),
        {
          role: "user",
          content:
            `Resultado da busca no catálogo do Ajuda+: ${outcome.summary}\n\n` +
            "Responda ao usuário em uma ou duas frases curtas, baseado apenas nesse resultado. " +
            "Se nada foi encontrado, diga isso com clareza. Não invente prestadores, notas ou preços.",
        },
      ]);
      // Mensagem e cards no mesmo commit: os prestadores nunca aparecem antes.
      setMessages([
        ...withUser,
        { role: "assistant", content: sanitizeReply(followUp) || outcome.summary },
      ]);
      setSearchLabel(outcome.label);
      setProviders(outcome.providers);
    } catch {
      // llm.error só cobre falha de carga do modelo, não de geração.
      setSendError("Não consegui responder agora. Tente reformular a mensagem.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, llm, messages, buildContext, runSearch]);

  // Fallback determinístico: toca numa categoria e busca direto, sem depender do
  // modelo. Aqui não há mensagem para esperar, então publica assim que chega.
  const handleCategoryChip = useCallback(
    async (category: Category) => {
      setSearching(true);
      setSearchLabel(category.name);
      setProviders(await fetchProviders(category.id));
      setSearching(false);
    },
    [fetchProviders],
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

  // Bolha viva enquanto gera. Some sozinha quando a mensagem entra na transcrição.
  // No 1º turno o texto costuma ser só a tool call, que sanitizeReply zera.
  const streamingText = llm.isGenerating ? sanitizeReply(llm.response) : "";
  const streaming = streamingText.length > 0 ? streamingText : null;

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
        {messages.length === 0 && !streaming ? (
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="sparkles" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.introTitle}>Como posso ajudar?</Text>
            <Text style={styles.introSub}>
              Me conta em poucas palavras o que está acontecendo. Eu entendo o problema, sugiro a
              melhor solução e chamo os profissionais mais bem avaliados perto de você.
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

        {messages.map((m, i) => (
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

        {busy && !streaming ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
            <Text style={styles.typingText}>Pensando…</Text>
          </View>
        ) : null}

        {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}

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
                    <View style={styles.providerNameRow}>
                      <Text style={styles.providerName}>{p.name}</Text>
                      <View
                        style={[styles.availabilityDot, !p.isAvailable && styles.availabilityDotOff]}
                      />
                    </View>
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
          editable={!busy}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <Pressable
          style={[styles.sendBtn, (busy || !input.trim()) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={busy || !input.trim()}
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
  providerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  providerName: { fontSize: 15, fontFamily: fonts.bold, color: theme.colors.foreground },
  availabilityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.success },
  availabilityDotOff: { backgroundColor: theme.colors.mutedForeground },
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
