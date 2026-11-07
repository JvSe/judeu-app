import { randomUUID } from "node:crypto";

import { env } from "@judeu/env/server";

import { supabase } from "./db";
import { trackEvent } from "./events";
import { notifyTrustedContact } from "./family";
import { sendEmail } from "./mailer";

// Botão de emergência: o app liga para o 190 e, ao mesmo tempo, registra aqui
// um chamado de SEGURANÇA com o pedido e a localização, para o suporte agir.

const ACTIVE = new Set(["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"]);

export function emergencyMessage(input: {
  byRole: "client" | "provider";
  orderId: string;
  status: string;
  lat: number | null;
  lng: number | null;
}): string {
  const who = input.byRole === "client" ? "o cliente" : "quem está atendendo";
  const where =
    input.lat != null && input.lng != null
      ? `Localização no momento: https://www.openstreetmap.org/?mlat=${input.lat}&mlon=${input.lng}#map=17/${input.lat}/${input.lng}`
      : "Localização não disponível.";
  return `EMERGÊNCIA acionada por ${who} no pedido ${input.orderId} (status ${input.status}). O app abriu a ligação para o 190. ${where}`;
}

export async function triggerEmergency(
  orderId: string,
  userId: string,
  position: { lat: number; lng: number } | null,
): Promise<{ ticketId: string } | { error: string; status: number }> {
  const { data } = await supabase
    .from("order")
    .select("id, clientId, status, provider:providerprofile(userId)")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as unknown as {
    id: string;
    clientId: string;
    status: string;
    provider: { userId: string } | { userId: string }[] | null;
  } | null;
  const provider = Array.isArray(order?.provider) ? order?.provider[0] : order?.provider;
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  const byRole = order.clientId === userId ? "client" : provider?.userId === userId ? "provider" : null;
  if (!byRole) return { error: "Pedido não encontrado", status: 404 };
  if (!ACTIVE.has(order.status)) return { error: "O pedido não está em andamento", status: 409 };

  const now = new Date().toISOString();
  const ticketId = randomUUID();
  const message = emergencyMessage({
    byRole,
    orderId,
    status: order.status,
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
  });
  const { error } = await supabase.from("supportticket").insert({
    id: ticketId,
    userId,
    orderId,
    category: "SECURITY",
    subject: "EMERGÊNCIA durante o atendimento",
    message,
    updatedAt: now,
  });
  if (error) throw new Error(error.message);

  void trackEvent({ type: "emergency.triggered", userId, orderId, props: { byRole } });
  if (byRole === "client") void notifyTrustedContact(orderId, "emergency");
  const alertTo = env.SECURITY_ALERT_EMAIL;
  if (alertTo) {
    void sendEmail({ to: alertTo, subject: "[Ajuda+] EMERGÊNCIA acionada", body: message }).catch((err) =>
      console.error("[emergency] alerta por e-mail falhou:", err),
    );
  }
  return { ticketId };
}
