import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { catalogApi, jobsApi, type Category, type JobPosting, type ProviderListItem } from "@/lib/api";
import { contractTypeLabel, initialsOf, moneyFromCents, priceFromCents } from "@/lib/format";
import { useAddresses, useCategories, useMyProviderProfile, useOrders } from "@/lib/hooks";
import {
  AI_MODEL,
  buildAssistantTools,
  buildSystemPrompt,
  deriveClientPersonalization,
  JOB_TOOL_NAME,
  JOBS_SEARCH_TOOL_NAME,
  parseJobDraftFromTool,
  parseToolCall,
  resolveCategoryId,
  resolveContractType,
  sanitizeReply,
  SEARCH_TOOL_NAME,
  type ClientPersonalization,
  type JobDraftArgs,
  type JobSearchArgs,
  type SearchArgs,
} from "@/lib/assistant";
import { setJobDraft } from "@/lib/job-draft";
import { Avatar } from "@/components/ui/avatar";

type DisplayMessage = { role: "user" | "assistant"; content: string };

type SearchOutcome = {
  summary: string;
  label: string | null;
  providers: ProviderListItem[];
};

type JobSearchOutcome = {
  summary: string;
  label: string | null;
  jobs: JobPosting[];
};

const FALLBACK_REPLY =
  "Não entendi bem. Você precisa de um serviço agora, está procurando emprego, ou quer publicar uma vaga?";

// Quantas mensagens da conversa acompanham cada geração. `generate` não aplica
// a janela deslizante que o `sendMessage` da lib usa, então limitamos aqui para
// a conversa não estourar o contexto do modelo.
const CONTEXT_MESSAGES = 12;

export function AiAssistant() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useCategories();
  const { user } = useAuth();
  const { data: addresses = [] } = useAddresses();
  const { data: orders = [] } = useOrders("client");
  const { data: providerProfile } = useMyProviderProfile();
  const canPublishJobs = providerProfile?.isCompany === true;

  const llm = useLLM({ model: AI_MODEL });

  const [input, setInput] = useState("");
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<"providers" | "jobs" | null>(null);
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
  // Contexto do usuário (nome, cidade, categorias mais buscadas): sempre
  // re-derivado de dado real do backend, nunca persistido localmente.
  const personalizationRef = useRef<ClientPersonalization | undefined>(undefined);
  personalizationRef.current = useMemo(
    () => deriveClientPersonalization(user, addresses, orders, canPublishJobs),
    [user, addresses, orders, canPublishJobs],
  );

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
          summary: `O Judeu ainda não atende esse tipo de serviço. As categorias disponíveis são: ${cats
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

  const runJobSearch = useCallback(async (args: JobSearchArgs): Promise<JobSearchOutcome> => {
    const cats = categoriesRef.current;
    const categoryId = args.categoria ? resolveCategoryId(cats, args.categoria) : undefined;
    const contractType = args.contrato ? resolveContractType(args.contrato) : undefined;
    const termo = args.termo?.trim() || undefined;
    const label =
      cats.find((c) => c.id === categoryId)?.name ??
      (contractType ? contractTypeLabel(contractType) : null) ??
      termo ??
      null;

    try {
      const list = await jobsApi.list({
        categoryId,
        contractType,
        q: termo,
      });
      if (list.length === 0) {
        return {
          summary: label
            ? `Nenhuma vaga de ${label} está aberta no momento.`
            : "Nenhuma vaga aberta no momento.",
          label: null,
          jobs: [],
        };
      }
      const top = list
        .slice(0, 5)
        .map((j) => {
          const salary =
            j.salaryCents != null ? moneyFromCents(j.salaryCents) : "a combinar";
          return `${j.title} na ${j.providerCompany.name} (${contractTypeLabel(j.contractType)}, ${salary})`;
        })
        .join("; ");
      return {
        summary: `${list.length} vaga(s)${label ? ` de ${label}` : ""} encontradas: ${top}.`,
        label,
        jobs: list,
      };
    } catch {
      return {
        summary: "Não consegui buscar as vagas agora. Tente de novo em instantes.",
        label: null,
        jobs: [],
      };
    }
  }, []);

  const clearResults = useCallback(() => {
    setProviders([]);
    setJobs([]);
    setSearchLabel(null);
    setResultKind(null);
  }, []);

  // Contexto de cada geração: system prompt com as categorias reais + a conversa.
  const buildContext = useCallback(
    (history: DisplayMessage[]): Message[] => [
      {
        role: "system",
        content: buildSystemPrompt(categoriesRef.current, personalizationRef.current),
      },
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
      const raw = await llm.generate(
        buildContext(withUser),
        buildAssistantTools(categoriesRef.current, {
          canPublishJobs: personalizationRef.current?.canPublishJobs ?? false,
        }),
      );
      const call = parseToolCall(raw);

      if (!call) {
        const reply = sanitizeReply(raw);
        setMessages([
          ...withUser,
          {
            role: "assistant",
            content: reply || FALLBACK_REPLY,
          },
        ]);
        return;
      }

      if (call.name === SEARCH_TOOL_NAME) {
        clearResults();
        const outcome = await runSearch(call.arguments as SearchArgs);
        const followUp = await llm.generate([
          ...buildContext(withUser),
          {
            role: "user",
            content:
              `Resultado da busca no catálogo do Judeu: ${outcome.summary}\n\n` +
              "Responda em uma ou duas frases curtas, com tom natural — pode usar o nome da pessoa se fizer sentido, sem exagerar. " +
              "Baseie-se apenas nesse resultado; se nada foi encontrado, diga isso com clareza. " +
              "Não invente prestadores, notas ou preços.",
          },
        ]);
        setMessages([
          ...withUser,
          { role: "assistant", content: sanitizeReply(followUp) || outcome.summary },
        ]);
        setSearchLabel(outcome.label);
        setProviders(outcome.providers);
        setResultKind("providers");
        return;
      }

      if (call.name === JOBS_SEARCH_TOOL_NAME) {
        clearResults();
        const outcome = await runJobSearch(call.arguments as JobSearchArgs);
        const followUp = await llm.generate([
          ...buildContext(withUser),
          {
            role: "user",
            content:
              `Resultado da busca de vagas no Judeu: ${outcome.summary}\n\n` +
              "Responda em uma ou duas frases curtas, com tom natural — pode usar o nome da pessoa se fizer sentido, sem exagerar. " +
              "Baseie-se apenas nesse resultado; se nada foi encontrado, diga isso com clareza. " +
              "Não invente vagas, empresas ou salários.",
          },
        ]);
        setMessages([
          ...withUser,
          { role: "assistant", content: sanitizeReply(followUp) || outcome.summary },
        ]);
        setSearchLabel(outcome.label);
        setJobs(outcome.jobs);
        setResultKind("jobs");
        return;
      }

      if (call.name === JOB_TOOL_NAME) {
        if (!personalizationRef.current?.canPublishJobs) {
          setMessages([
            ...withUser,
            {
              role: "assistant",
              content:
                "Publicar vaga é para empresas cadastradas no Judeu. Você precisa de um prestador pra um serviço agora, ou está procurando emprego?",
            },
          ]);
          return;
        }
        const draft = parseJobDraftFromTool(call.arguments as JobDraftArgs, categoriesRef.current);
        if (!draft) {
          setMessages([
            ...withUser,
            {
              role: "assistant",
              content:
                "Ainda falta algum dado da vaga. Me conta categoria, título, o que a pessoa vai fazer, contrato, salário (ou a combinar) e os dias/horários.",
            },
          ]);
          return;
        }
        setJobDraft(draft);
        setMessages([
          ...withUser,
          {
            role: "assistant",
            content: "Fechei a vaga com o que você me passou. Dá uma olhada e publica se estiver ok.",
          },
        ]);
        router.push("/provider/vaga/ai/review");
        return;
      }

      const reply = sanitizeReply(raw);
      setMessages([
        ...withUser,
        {
          role: "assistant",
          content: reply || FALLBACK_REPLY,
        },
      ]);
    } catch {
      setSendError("Não consegui responder agora. Tente reformular a mensagem.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, llm, messages, buildContext, runSearch, runJobSearch, clearResults]);

  // Fallback determinístico: toca numa categoria e busca direto, sem depender do
  // modelo. Aqui não há mensagem para esperar, então publica assim que chega.
  const handleCategoryChip = useCallback(
    async (category: Category) => {
      setSearching(true);
      setJobs([]);
      setResultKind("providers");
      setSearchLabel(category.name);
      setProviders(await fetchProviders(category.id));
      setSearching(false);
    },
    [fetchProviders],
  );

  const handleJobsChip = useCallback(async () => {
    setSearching(true);
    setProviders([]);
    setResultKind("jobs");
    setSearchLabel("emprego");
    try {
      setJobs(await jobsApi.list());
    } catch {
      setJobs([]);
    }
    setSearching(false);
  }, []);

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
            <Text style={styles.introTitle}>Como posso te ajudar?</Text>
            <Text style={styles.introSub}>
              Me conta do seu jeito. Pode ser um serviço pra resolver agora, uma vaga de emprego
              ou, se você é empresa, publicar uma vaga. Eu te ajudo a chegar no que você
              realmente precisa.
            </Text>
            <View style={styles.chipsRow}>
              {categories.map((c) => (
                <Pressable key={c.id} style={styles.chip} onPress={() => handleCategoryChip(c)}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.chip} onPress={handleJobsChip}>
                <Text style={styles.chipText}>Vagas de emprego</Text>
              </Pressable>
              {canPublishJobs ? (
                <Pressable
                  style={styles.chip}
                  onPress={() => router.push("/provider/vaga/ai/chat")}
                >
                  <Text style={styles.chipText}>Publicar vaga</Text>
                </Pressable>
              ) : null}
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

        {resultKind === "providers" && (searching || providers.length > 0) && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {searchLabel ? `Prestadores de ${searchLabel}` : "Prestadores"}
            </Text>
            {searching && providers.length === 0 ? (
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

        {resultKind === "jobs" && (searching || jobs.length > 0) && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {searchLabel ? `Vagas de ${searchLabel}` : "Vagas"}
            </Text>
            {searching && jobs.length === 0 ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />
            ) : (
              jobs.map((job) => (
                <Pressable
                  key={job.id}
                  style={({ pressed }) => [styles.providerCard, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: job.id } })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName}>{job.title}</Text>
                    <Text style={styles.providerMeta}>
                      {job.providerCompany.name} · {contractTypeLabel(job.contractType)}
                    </Text>
                    <Text style={styles.jobSalary}>
                      {job.salaryCents != null ? moneyFromCents(job.salaryCents) : "Salário a combinar"}
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
          placeholder="Me conta o que você precisa…"
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
  jobSalary: {
    fontSize: 13.5,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    marginTop: 4,
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
