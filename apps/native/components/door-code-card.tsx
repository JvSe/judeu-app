import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import type { Order } from "@/lib/api";
import { useDoorCode, useRegenerateDoorCode } from "@/lib/hooks";
import { errorMessage, toast } from "@/lib/toast";

// Cliente: código que quem chega precisa informar para começar o serviço.
export function DoorCodeCard({ order }: { order: Order }) {
  const { theme } = useUnistyles();
  const visible = order.requiresDoorCode && (order.status === "ACCEPTED" || order.status === "EN_ROUTE");
  const { data } = useDoorCode(order.id, visible);
  const regenerate = useRegenerateDoorCode();
  if (!visible || !data?.code) return null;

  return (
    <View style={styles.card}>
      <Ionicons name="key-outline" size={22} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Código de chegada</Text>
        <Text style={styles.code}>{data.code.split("").join(" ")}</Text>
        <Text style={styles.hint}>
          {data.locked
            ? "Bloqueado por tentativas erradas. Gere um novo código."
            : "Só diga este código para quem chegar. É assim que você confirma que é a pessoa certa."}
        </Text>
        <Pressable
          hitSlop={8}
          disabled={regenerate.isPending}
          onPress={() =>
            regenerate.mutate(order.id, {
              onSuccess: () => toast.success("Novo código gerado"),
              onError: (e) => toast.error(errorMessage(e, "Não foi possível gerar outro código.")),
            })
          }
        >
          <Text style={styles.link}>Gerar outro código</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(255,102,0,0.08)",
    marginBottom: 12,
  },
  label: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.mutedForeground },
  code: { fontSize: 30, fontFamily: fonts.extraBold, color: "#fff", letterSpacing: 4, marginTop: 2 },
  hint: { fontSize: 13, fontFamily: fonts.medium, color: theme.colors.mutedForeground, marginTop: 4, lineHeight: 18 },
  link: { fontSize: 13, fontFamily: fonts.bold, color: theme.colors.primary, marginTop: 8 },
}));
