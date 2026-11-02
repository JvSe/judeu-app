import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import {
  CLIENT_ATTENDING_ROUTES,
  OrderDetailAttending,
} from "@/components/screens/order-detail-attending";
import { OrderDetailClient } from "@/components/screens/order-detail-client";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";
import { useOrder } from "@/lib/hooks";

// Uma rota só para os dois lados da chamada: quem pediu vê o detalhe de cliente;
// quem está atendendo (helper ou prestador) vê a visão de quem atende.
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useUnistyles();
  const { user } = useAuth();
  const { data: order, isLoading } = useOrder(id, { poll: true });

  if (isLoading || !order) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const attending = !!user && order.client.id !== user.id;
  return attending ? (
    <OrderDetailAttending routes={CLIENT_ATTENDING_ROUTES} />
  ) : (
    <OrderDetailClient />
  );
}
