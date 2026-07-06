import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { chatMessages, providers } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = providers.find((item) => item.id === id) ?? providers[0];
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(chatMessages);

  const send = () => {
    if (!draft.trim()) return;
    setMessages((current) => [
      ...current,
      { id: `${current.length + 1}`, from: "client" as const, text: draft.trim() },
    ]);
    setDraft("");
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Avatar initials={provider.initials} color={provider.color} size={42} radius={13} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{provider.name}</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>online</Text>
            </View>
          </View>
          <Pressable style={styles.phoneButton}>
            <Ionicons name="call" size={18} color="#fff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          <View style={styles.dayChip}>
            <Text style={styles.dayChipText}>Hoje</Text>
          </View>
          <View style={styles.serviceChip}>
            <Text style={styles.serviceChipEyebrow}>Serviço contratado</Text>
            <Text style={styles.serviceChipTitle}>
              {provider.services[0].name} · R$ {provider.services[0].price}
            </Text>
          </View>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.from === "client" ? styles.bubbleClient : styles.bubbleProvider,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  message.from === "client" && styles.bubbleTextClient,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.plusButton}>
            <Ionicons name="add" size={20} color={theme.colors.mutedForeground} />
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Mensagem…"
            placeholderTextColor={theme.colors.mutedForeground}
            style={styles.input}
            onSubmitEditing={send}
          />
          <Pressable style={styles.sendButton} onPress={send}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: "rgba(20,20,44,0.95)",
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  onlineText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: theme.colors.success,
  },
  phoneButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  messages: {
    padding: 16,
    gap: 10,
    paddingBottom: 16,
  },
  dayChip: {
    alignSelf: "center",
  },
  dayChipText: {
    backgroundColor: "rgba(255,255,255,0.07)",
    color: theme.colors.mutedForeground,
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },
  serviceChip: {
    alignSelf: "center",
    backgroundColor: "rgba(255,102,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,102,0,0.3)",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 15,
    maxWidth: "88%",
    alignItems: "center",
  },
  serviceChipEyebrow: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  serviceChipTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#fff",
    marginTop: 3,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  bubbleProvider: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(28,28,58,0.9)",
    borderBottomLeftRadius: 5,
  },
  bubbleClient: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 5,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: "#e8e8f5",
  },
  bubbleTextClient: {
    color: "#fff",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: "rgba(20,20,44,0.95)",
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(28,28,58,0.9)",
    paddingHorizontal: 18,
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#fff",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
