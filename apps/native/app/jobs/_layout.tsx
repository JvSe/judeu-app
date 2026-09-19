import "@/unistyles";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import { useAuth } from "@/lib/auth-context";

// Grupo de rotas independente de client/provider: qualquer usuário autenticado
// pode navegar aqui, seja qual for o seu papel (CLIENT/PROVIDER/BOTH) — não há
// seletor de papel no app, então candidatar-se a vagas não pode ficar preso a
// um dos dois lados.
export default function JobsLayout() {
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
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="my-applications" />
    </Stack>
  );
}
