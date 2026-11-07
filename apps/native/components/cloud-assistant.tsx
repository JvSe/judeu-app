import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
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

import { fonts } from "@/constants/fonts";
import {
  assistantApi,
  catalogApi,
  jobsApi,
  type CloudAssistantAction,
  type JobPosting,
  type ProviderListItem,
} from "@/lib/api";
import { confirmRequestPath, priceFromCents } from "@/lib/format";
import { errorMessage } from "@/lib/toast";

type Turn = { role: "user" | "assistant"; content: string };

// JudIA em nuvem: usada quando o modelo não roda no aparelho (Expo Go, web,
// aparelho sem suporte). O servidor classifica o pedido (Claude, ou palavras-
// chave sem chave de API) e devolve uma ação; aqui buscamos o dado real.
export function CloudAssistant() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: "Oi! Me conta o que você precisa, do seu jeito." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderListItem[] | null>(null);
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);

  const runAction = async (action: CloudAssistantAction): Promise<string | null> => {
    if (action.type === "help_request") {
      router.push(
        confirmRequestPath({
          description: action.description,
          categoryId: action.categoryId ?? undefined,
          priceCents: action.priceCents ?? undefined,
        }) as never,
      );
      return null;
    }
    if (action.type === "providers") {
      const list = await catalogApi.providers(action.categoryId).catch(() => []);
      setProviders(list);
      return list.length === 0 ? `Ninguém de ${action.categoryName} está disponível agora.` : null;
    }
    const list = await jobsApi
      .list({ categoryId: action.categoryId ?? undefined, q: action.term ?? undefined })
      .catch(() => []);
    setJobs(list);
    return list.length === 0 ? "Nenhuma vaga aberta com esse perfil agora." : null;
  };

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    const history = turns.slice(1);
    const next: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(next);
    setInput("");
    setProviders(null);
    setJobs(null);
    setBusy(true);
    try {
      const res = await assistantApi.ask({ message, conversationId, history });
      setConversationId(res.conversationId);
      const note = res.action ? await runAction(res.action) : null;
      setTurns([...next, { role: "assistant", content: note ?? res.reply }]);
    } catch (e) {
      setTurns([
        ...next,
        { role: "assistant", content: errorMessage(e, "Não consegui responder agora. Tente de novo.") },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 60}
    >
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {turns.map((t, i) => (
          <View key={i} style={[styles.bubble, t.role === "user" ? styles.mine : styles.theirs]}>
            <Text style={styles.bubbleText}>{t.content}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 8 }} />}

        {providers?.map((p) => (
          <Pressable
            key={p.id}
            style={styles.card}
            onPress={() => router.push({ pathname: "/client/provider/[id]", params: { id: p.id } })}
          >
            <Text style={styles.cardTitle}>{p.companyName ?? p.name}</Text>
            <Text style={styles.cardMeta}>
              {p.role ?? "Profissional"} · nota {p.rating.toFixed(1)} · a partir de{" "}
              {priceFromCents(p.priceFromCents)}
            </Text>
          </Pressable>
        ))}
        {jobs?.map((j) => (
          <Pressable
            key={j.id}
            style={styles.card}
            onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: j.id } })}
          >
            <Text style={styles.cardTitle}>{j.title}</Text>
            <Text style={styles.cardMeta}>
              {j.providerCompany.companyName ?? j.providerCompany.name} · {j.category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ex.: preciso de alguém pra buscar um remédio"
          placeholderTextColor={theme.colors.mutedForeground}
          multiline
          maxLength={600}
          editable={!busy}
        />
        <Pressable
          onPress={() => void send()}
          disabled={busy || !input.trim()}
          style={({ pressed }) => [styles.send, { opacity: busy || !input.trim() ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  mine: { alignSelf: "flex-end", backgroundColor: theme.colors.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: "rgba(28,28,58,0.92)" },
  bubbleText: { fontSize: 15, fontFamily: fonts.medium, color: "#fff", lineHeight: 21 },
  card: {
    backgroundColor: "rgba(28,28,58,0.7)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
  cardMeta: { fontSize: 13, fontFamily: fonts.medium, color: theme.colors.mutedForeground, marginTop: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(20,20,44,0.95)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#fff",
    backgroundColor: "rgba(28,28,58,0.92)",
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
}));
