import "@/unistyles";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { env } from "@judeu/env/native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUnistyles } from "react-native-unistyles";

import { AuthProvider } from "@/lib/auth-context";
import { pathForNotification } from "@/lib/notifications";
import { QueryProvider } from "@/lib/query";
import { initAssistant } from "@/lib/assistant";

// Registra o resource fetcher do ExecuTorch antes de qualquer hook de IA (seção 2.3 do guia).
// Guardado: em Expo Go / web o módulo nativo não existe e não deve derrubar o boot.
initAssistant();

SplashScreen.preventAutoHideAsync();

// Mostra o alerta mesmo com o app em primeiro plano (padrão do SDK é não mostrar).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = pathForNotification(response.notification.request.content.data ?? {});
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [router]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
        <QueryProvider>
          <AuthProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="client" />
              <Stack.Screen name="provider" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="privacy-policy" />
            </Stack>
          </AuthProvider>
        </QueryProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
