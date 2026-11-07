import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import notifee, { AndroidImportance } from "react-native-notify-kit";

/**
 * Canal Android de pedidos — id versionado porque o som do canal não muda depois
 * de criado no aparelho (`incoming-help` antigo ficava com o som default).
 */
export const INCOMING_HELP_CHANNEL = "incoming-help-judeu";

/** Nome do recurso Android (sem extensão) / arquivo iOS no bundle. */
export const INCOMING_HELP_SOUND = "judeu";
export const INCOMING_HELP_SOUND_FILE = "judeu.wav";

let channelsReady: Promise<void> | null = null;

/** Cria canais Android (expo-notifications + notifee) — seguro chamar mais de uma vez. */
export function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Geral",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      await Notifications.setNotificationChannelAsync(INCOMING_HELP_CHANNEL, {
        name: "Pedidos de ajuda",
        importance: Notifications.AndroidImportance.HIGH,
        sound: INCOMING_HELP_SOUND,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
      });
      await notifee.createChannel({
        id: "default",
        name: "Geral",
        importance: AndroidImportance.DEFAULT,
      });
      await notifee.createChannel({
        id: INCOMING_HELP_CHANNEL,
        name: "Pedidos de ajuda",
        importance: AndroidImportance.HIGH,
        sound: INCOMING_HELP_SOUND,
        vibration: true,
      });
    })().catch(() => {
      channelsReady = null;
    });
  }
  return channelsReady ?? Promise.resolve();
}

// Registro de push (RF-E2): exige device físico + dev client/build nativo (Expo Go não
// suporta push remoto desde o SDK 53) + projeto EAS (`eas init`). Sem token, no-op silencioso.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  await ensureNotificationChannels();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
}
