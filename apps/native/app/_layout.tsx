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
import notifee, { EventType } from "react-native-notify-kit";

import { AnimatedSplash } from "@/components/animated-splash";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";
import { AuthProvider } from "@/lib/auth-context";
// Registra a task de localização em background no boot (exigência do TaskManager).
import "@/lib/background-location";
import { initAssistant } from "@/lib/assistant";
import { pathForNotification } from "@/lib/notifications";
import {
  ensureNotificationChannels,
  INCOMING_HELP_CHANNEL,
  INCOMING_HELP_SOUND_FILE,
  isIncomingHelp,
} from "@/lib/push";
import { QueryProvider } from "@/lib/query";
import { Toaster } from "@/lib/toast";

// Registra o resource fetcher do ExecuTorch antes de qualquer hook de IA (seção 2.3 do guia).
// Guardado: em Expo Go / web o módulo nativo não existe e não deve derrubar o boot.
initAssistant();

SplashScreen.preventAutoHideAsync();

// Evita que o notifee intercepte o delegate de push remoto no iOS — o
// addNotificationResponseReceivedListener do expo-notifications continua no
// controle do tap em background/killed; o notifee só exibe em primeiro plano.
notifee.setNotificationConfig({ ios: { handleRemoteNotifications: false } });

// Não mostra o alerta nativo em primeiro plano — o notifee exibe no lugar (useEffect abaixo).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = {
  initialRouteName: "index",
};

function NotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      const path = pathForNotification(detail.notification?.data ?? {});
      if (path) router.push(path as never);
    });
  }, [router]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = pathForNotification(response.notification.request.content.data ?? {});
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const { theme } = useUnistyles();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void ensureNotificationChannels();
  }, []);

  // Exibe via notifee (em vez do banner nativo) quando a push chega com o app aberto.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((event) => {
      const { title, body, data } = event.request.content;
      const incomingHelp = isIncomingHelp(data);
      notifee.displayNotification({
        title: title ?? undefined,
        body: body ?? undefined,
        data: data as Record<string, string | number | object>,
        android: {
          channelId: incomingHelp ? INCOMING_HELP_CHANNEL : "default",
          pressAction: { id: "default" },
        },
        ios: { sound: incomingHelp ? INCOMING_HELP_SOUND_FILE : "default" },
      });
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}>
        <QueryProvider>
          <AuthProvider>
            <AuthSessionBoundary />
            <NotificationNavigation />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="client" />
              <Stack.Screen name="jobs" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="privacy-policy" />
            </Stack>
            <AnimatedSplash />
            <Toaster position="top" theme="system" />
          </AuthProvider>
        </QueryProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
