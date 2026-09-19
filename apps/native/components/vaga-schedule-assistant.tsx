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
import type { Category } from "@/lib/api";
import {
  AI_MODEL,
  buildJobSystemPrompt,
  buildJobTool,
  deriveCompanyPersonalization,
  JOB_TOOL_NAME,
  parseJobDraftFromTool,
  parseToolCallArgs,
  sanitizeReply,
  type CompanyPersonalization,
  type JobDraftArgs,
} from "@/lib/assistant";
import { useCategories, useMyJobPostings } from "@/lib/hooks";
import { setJobDraft } from "@/lib/job-draft";

type DisplayMessage = { role: "user" | "assistant"; content: string };

// Mesma janela de contexto usada na busca de prestadores (lib/assistant.ts).
const CONTEXT_MESSAGES = 12;

export function VagaAssistant() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: jobPostings = [] } = useMyJobPostings();

  const llm = useLLM({ model: AI_MODEL });

  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const categoriesRef = useRef<Category[]>(categories);
  categoriesRef.current = categories;
  // Contexto do usuário (nome, categoria de vaga mais publicada): sempre
  // re-derivado de dado real do backend, nunca persistido localmente.
  const personalizationRef = useRef<CompanyPersonalization | undefined>(undefined);
  personalizationRef.current = useMemo(
    () => deriveCompanyPersonalization(user, jobPostings),
    [user, jobPostings],
  );

  const buildContext = useCallback(
    (history: DisplayMessage[]): Message[] => [
      {
        role: "system",
        content: buildJobSystemPrompt(categoriesRef.current, personalizationRef.current),
      },
      ...history.slice(-CONTEXT_MESSAGES),
    ],
    [],
  );

  // Sem 2º turno aqui: diferente da busca de prestadores, não há dado real de
  // backend pra reconciliar a vaga proposta — a revisão humana na tela
  // seguinte é a salvaguarda contra erro do modelo.
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setSendError(null);
    setBusy(true);

    const withUser: DisplayMessage[] = [...messages, { role: "user", content: text }];
    setMessages(withUser);

    try {
      const raw = await llm.generate(buildContext(withUser), [buildJobTool(categoriesRef.current)]);
      const args = parseToolCallArgs<JobDraftArgs>(raw, JOB_TOOL_NAME);

      if (!args) {
        const reply = sanitizeReply(raw);
        setMessages([
          ...withUser,
          {
            role: "assistant",
            content:
              reply ||
              "Não entendi bem. Me conta a vaga do seu jeito — o que a pessoa vai fazer, contrato, salário e os dias. Se for um serviço pontual, também posso te orientar.",
          },
        ]);
        return;
      }

      const draft = parseJobDraftFromTool(args, categoriesRef.current);
      if (!draft) {
        setMessages([
          ...withUser,
          {
            role: "assistant",
            content:
              "Ainda falta algum dado. Me conta o que ainda não falou — categoria, o que a pessoa vai fazer, contrato, salário (ou a combinar) e a escala.",
          },
        ]);
        return;
      }

      setJobDraft(draft);
      router.push("/provider/vaga/ai/review");
    } catch {
      setSendError("Não consegui responder agora. Tente reformular a mensagem.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, llm, messages, buildContext]);

  // --- Estado 1: carregando o modelo ---
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
              <Ionicons name="briefcase-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.introTitle}>Qual vaga você quer publicar?</Text>
            <Text style={styles.introSub}>
              Conte o que precisa — o que a pessoa vai fazer, se é CLT, o salário, os dias. Eu te
              ajudo a completar o que faltar. Se na verdade você quer um profissional pontual, me
              fala também.
            </Text>
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
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Me conta a vaga do seu jeito…"
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
