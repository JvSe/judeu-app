import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Share, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import type { Order } from "@/lib/api";
import { useOrderShare } from "@/lib/hooks";

const ACTIVE = new Set(["CREATED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"]);

// Cliente: mostra que a família acompanha este pedido e permite reenviar o link.
export function FamilyShareCard({ order }: { order: Order }) {
  const { theme } = useUnistyles();
  const { data: share } = useOrderShare(order.id, ACTIVE.has(order.status));
  if (!share || !ACTIVE.has(order.status)) return null;

  return (
    <View style={styles.card}>
      <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {share.contactName ? `${share.contactName} acompanha este pedido` : "Sua família acompanha este pedido"}
        </Text>
        <Text style={styles.text}>Os avisos vão por e-mail. Você também pode enviar o link.</Text>
      </View>
      <Pressable
        hitSlop={8}
        onPress={() => void Share.share({ message: `Acompanhe meu pedido no Ajuda+: ${share.url}` })}
      >
        <Ionicons name="share-outline" size={22} color={theme.colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(28,28,58,0.92)",
    marginBottom: 12,
  },
  title: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
  text: { fontSize: 12.5, fontFamily: fonts.medium, color: theme.colors.mutedForeground, marginTop: 2 },
}));
