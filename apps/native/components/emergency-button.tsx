import "@/unistyles";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Linking, Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { fonts } from "@/constants/fonts";
import { ordersApi } from "@/lib/api";
import { readForegroundPosition } from "@/lib/location";

const ACTIVE = new Set(["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"]);
const EMERGENCY_NUMBER = "190";

// Liga para o 190 na hora e, em paralelo, avisa o suporte (e a família, se o
// cliente tiver contato de confiança) com o pedido e a localização.
async function callEmergency(orderId: string) {
  void Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
  try {
    const position = await readForegroundPosition().catch(() => null);
    await ordersApi.emergency(orderId, position);
  } catch {
    // A ligação já foi aberta; o registro é secundário.
  }
}

export function EmergencyButton({
  orderId,
  status,
  variant = "round",
}: {
  orderId: string;
  status: string;
  variant?: "round" | "wide";
}) {
  if (!ACTIVE.has(status)) return null;

  const confirm = () =>
    Alert.alert(
      "Emergência",
      `Vamos ligar para a polícia (${EMERGENCY_NUMBER}) e avisar a equipe do Ajuda+ com a sua localização.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: `Ligar ${EMERGENCY_NUMBER}`, style: "destructive", onPress: () => void callEmergency(orderId) },
      ],
    );

  if (variant === "wide") {
    return (
      <Pressable style={styles.wide} onPress={confirm} accessibilityRole="button" accessibilityLabel="Emergência">
        <Ionicons name="alert-circle" size={20} color="#fff" />
        <Text style={styles.wideText}>Emergência · ligar {EMERGENCY_NUMBER}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.round} onPress={confirm} accessibilityRole="button" accessibilityLabel="Emergência">
      <Text style={styles.roundText}>SOS</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create(() => ({
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d92d20",
  },
  roundText: { fontSize: 13, fontFamily: fonts.extraBold, color: "#fff", letterSpacing: 0.5 },
  wide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#d92d20",
    marginBottom: 12,
  },
  wideText: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
}));
