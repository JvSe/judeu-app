import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
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
import { useAuth } from "@/lib/auth-context";
import { initialsOf, moneyFromCents } from "@/lib/format";
import { useMessages, useOrder, useSendMessage } from "@/lib/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const { data: order, isLoading } = useOrder(id);
  const { data: messages = [] } = useMessages(id);
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState("");

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const send = () => {
    if (!draft.trim()) return;
    sendMessage.mutate({ orderId: order.id, body: draft.trim() });
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
          <Avatar initials={initialsOf(order.provider?.name ?? "?")} size={42} radius={13} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{order.provider?.name ?? "Prestador"}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {order.service && (
            <View style={styles.serviceChip}>
              <Text style={styles.serviceChipEyebrow}>Serviço contratado</Text>
              <Text style={styles.serviceChipTitle}>
                {order.service.name} · {moneyFromCents(order.totalCents)}
              </Text>
            </View>
          )}
          {messages.map((message) => {
            const mine = message.senderId === user?.id;
            return (
              <View
                key={message.id}
                style={[styles.bubble, mine ? styles.bubbleClient : styles.bubbleProvider]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextClient]}>
                  {message.body}
                </Text>
              </View>
            );
          })}
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
  messages: {
    padding: 16,
    gap: 10,
    paddingBottom: 16,
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
