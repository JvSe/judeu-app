import { randomUUID } from "node:crypto";

import { supabase } from "./db";
import { notifyUser } from "./notifications";

export type MessageDTO = {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type SendMessageInput = { body: string };

function toDTO(m: {
  id: string;
  orderId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; fullName: string };
}): MessageDTO {
  return {
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    senderName: m.sender.fullName,
    body: m.body,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}

async function authorize(
  userId: string,
  orderId: string,
): Promise<
  { error: string; status: number } | { clientId: string; providerUserId: string | null }
> {
  const { data: order } = await supabase
    .from("order")
    .select("clientId, provider:providerprofile(userId)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const provider = order.provider as unknown as { userId: string } | null;
  const isClient = order.clientId === userId;
  const isProvider = provider?.userId === userId;
  if (!isClient && !isProvider) {
    return { error: "Você não participou deste pedido", status: 403 };
  }
  return { clientId: order.clientId, providerUserId: provider?.userId ?? null };
}

export async function listMessages(
  userId: string,
  orderId: string,
): Promise<MessageDTO[] | { error: string; status: number }> {
  const participants = await authorize(userId, orderId);
  if ("error" in participants) return participants;

  await supabase
    .from("message")
    .update({ readAt: new Date().toISOString() })
    .eq("orderId", orderId)
    .neq("senderId", userId)
    .is("readAt", null);

  const { data: rows, error } = await supabase
    .from("message")
    .select("*, sender:user!inner(id, fullName)")
    .eq("orderId", orderId)
    .order("createdAt", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (rows ?? []).map((r) => toDTO(r as unknown as Parameters<typeof toDTO>[0]));
}

export async function sendMessage(
  senderId: string,
  orderId: string,
  input: SendMessageInput,
): Promise<MessageDTO | { error: string; status: number }> {
  const participants = await authorize(senderId, orderId);
  if ("error" in participants) return participants;

  const { data: message, error } = await supabase
    .from("message")
    .insert({
      id: randomUUID(),
      orderId,
      senderId,
      body: input.body,
    })
    .select("*, sender:user!inner(id, fullName)")
    .single();
  if (error || !message) throw new Error(error?.message ?? "Falha ao enviar");

  const row = message as unknown as Parameters<typeof toDTO>[0];
  const recipientId =
    senderId === participants.clientId ? participants.providerUserId : participants.clientId;
  if (recipientId) {
    void notifyUser(recipientId, "MESSAGE", {
      title: `Nova mensagem de ${row.sender.fullName}`,
      body: input.body,
      data: {
        type: "chat",
        orderId,
        role: senderId === participants.clientId ? "provider" : "client",
      },
    });
  }

  return toDTO(row);
}
