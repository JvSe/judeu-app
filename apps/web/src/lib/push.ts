import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Push notifications (RF-E2): via Expo Push API (gratuita, sem chave) — o app
// registra o token do dispositivo (POST /api/push-token) e este módulo dispara
// o envio a partir dos eventos do domínio (novo pedido, transição, mensagem).
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Fire-and-forget: notificação é um extra, nunca deve derrubar o fluxo principal
// (criar pedido, enviar mensagem etc.) se o envio falhar ou o usuário não tiver token.
export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
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
    // Best-effort — sem retry/log estruturado por ora (RNF-7, observabilidade, pendente).
  }
}
