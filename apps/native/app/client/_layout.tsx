import "@/unistyles";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import { useAuth } from "@/lib/auth-context";

export default function ClientLayout() {
  const { theme } = useUnistyles();
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (status === "unauthenticated") {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="provider/[id]" />
      <Stack.Screen name="payment/[id]" />
      <Stack.Screen name="tracking/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="create-order" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="rating/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="support" />
      <Stack.Screen name="support-ticket-new" />
      <Stack.Screen name="support-ticket/[id]" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="address-form" />
    </Stack>
  );
}
