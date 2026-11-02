import { supabase } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("user")
      .select("pushToken")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.pushToken) return;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: user.pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }),
    });
  } catch {
    // Best-effort
  }
}
