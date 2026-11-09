import { supabase } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Canal Android criado no app (`apps/native/lib/push.ts`) — HIGH + som custom. */
export const INCOMING_HELP_CHANNEL = "incoming-help-judeu";

/** Arquivo registrado no plugin `expo-notifications` (`assets/sounds/judeu.wav`). */
export const INCOMING_HELP_SOUND = "judeu.wav";

/** Valor de `data.alert` nos avisos de pedido novo para quem atende — únicos com o som `judeu`. */
export const INCOMING_HELP_ALERT = "incoming_help";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Expo: "default" | nome do arquivo no bundle. */
  sound?: string | null;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("user")
      .select("pushToken")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.pushToken) return;

    const isOrder = payload.data?.type === "order";
    const isIncomingHelp = payload.data?.alert === INCOMING_HELP_ALERT;
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: user.pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: payload.sound ?? (isIncomingHelp ? INCOMING_HELP_SOUND : "default"),
        channelId: payload.channelId ?? (isIncomingHelp ? INCOMING_HELP_CHANNEL : "default"),
        priority: payload.priority ?? (isOrder ? "high" : "default"),
      }),
    });
  } catch {
    // Best-effort
  }
}
