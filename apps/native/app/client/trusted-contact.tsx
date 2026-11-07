import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Screen } from "@/components/ui/screen";
import { fonts } from "@/constants/fonts";
import { useSetTrustedContact, useTrustedContact } from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

// Modo família: a pessoa cadastrada recebe e-mail quando alguém aceita, sai,
// chega e termina o pedido, com um link para acompanhar em tempo real.
export default function TrustedContactScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { data: contact, isLoading } = useTrustedContact();
  const save = useSetTrustedContact();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setEmail(contact.email);
    }
  }, [contact]);

  const submit = async (remove = false) => {
    try {
      await save.mutateAsync(remove ? null : { name: name.trim(), email: email.trim() });
      toast.success(remove ? "Contato removido" : "Contato salvo");
      if (remove) {
        setName("");
        setEmail("");
      }
    } catch (e) {
      toast.error(errorMessage(e, "Não foi possível salvar."));
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Contato de confiança</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.text}>
            Um filho, neto ou vizinho pode acompanhar seus pedidos. A cada pedido novo, essa pessoa
            recebe por e-mail quem vai ajudar, quando saiu, quando chegou e quando terminou, com um
            link para acompanhar a chegada.
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome (ex.: Ana, minha filha)"
            placeholderTextColor={theme.colors.mutedForeground}
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor={theme.colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.primary, (save.isPending || name.trim().length < 2 || !email.includes("@")) && { opacity: 0.5 }]}
            disabled={save.isPending || name.trim().length < 2 || !email.includes("@")}
            onPress={() => void submit()}
          >
            <Text style={styles.primaryText}>{contact ? "Salvar alterações" : "Salvar contato"}</Text>
          </Pressable>
          {contact && (
            <Pressable onPress={() => void submit(true)} hitSlop={8} style={{ alignSelf: "center" }}>
              <Text style={styles.remove}>Remover contato</Text>
            </Pressable>
          )}
          <Text style={styles.small}>Vale para os pedidos criados depois de salvar.</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: fonts.extraBold, color: "#fff" },
  content: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  text: { fontSize: 14, fontFamily: fonts.medium, color: theme.colors.mutedForeground, lineHeight: 21 },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#fff",
    backgroundColor: "rgba(28,28,58,0.92)",
  },
  primary: { backgroundColor: theme.colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  primaryText: { fontSize: 16, fontFamily: fonts.bold, color: "#fff" },
  remove: { fontSize: 14, fontFamily: fonts.bold, color: theme.colors.destructive },
  small: { fontSize: 12.5, fontFamily: fonts.medium, color: theme.colors.mutedForeground, textAlign: "center" },
}));
