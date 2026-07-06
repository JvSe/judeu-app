import "@/unistyles";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import { useAuth } from "@/lib/auth-context";

export default function ProviderLayout() {
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
      <Stack.Screen name="kyc" />
    </Stack>
  );
}
