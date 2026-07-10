import { prisma } from "./db";
import { notifyUser } from "./notifications";

// ---------------------------------------------------------------------------
// Chat: mensagens reais cliente ↔ prestador, ancoradas a um pedido (RF-E1).
// ---------------------------------------------------------------------------

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
  readAt: Date | null;
  createdAt: Date;
  sender: { id: string; fullName: string };
}): MessageDTO {
  return {
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    senderName: m.sender.fullName,
    body: m.body,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

async function authorize(
  userId: string,
  orderId: string,
): Promise<
  { error: string; status: number } | { clientId: string; providerUserId: string | null }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { provider: { select: { userId: true } } },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 } as const;

  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  if (!isClient && !isProvider) {
    return { error: "Você não participou deste pedido", status: 403 } as const;
  }
  return { clientId: order.clientId, providerUserId: order.provider?.userId ?? null } as const;
}

// Lista o histórico do pedido e marca como lidas as mensagens da outra parte
// (abrir a conversa == ver as mensagens).
export async function listMessages(
  userId: string,
  orderId: string,
): Promise<MessageDTO[] | { error: string; status: number }> {
  const participants = await authorize(userId, orderId);
  if ("error" in participants) return participants;

  await prisma.message.updateMany({
    where: { orderId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  const rows = await prisma.message.findMany({
    where: { orderId },
    include: { sender: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return rows.map(toDTO);
}

export async function sendMessage(
  senderId: string,
  orderId: string,
  input: SendMessageInput,
): Promise<MessageDTO | { error: string; status: number }> {
  const participants = await authorize(senderId, orderId);
  if ("error" in participants) return participants;

  const message = await prisma.message.create({
    data: {
      order: { connect: { id: orderId } },
      sender: { connect: { id: senderId } },
      body: input.body,
    },
    include: { sender: { select: { id: true, fullName: true } } },
  });

  const recipientId =
    senderId === participants.clientId ? participants.providerUserId : participants.clientId;
  if (recipientId) {
    void notifyUser(recipientId, "MESSAGE", {
      title: `Nova mensagem de ${message.sender.fullName}`,
      body: input.body,
      data: { type: "chat", orderId, role: senderId === participants.clientId ? "provider" : "client" },
    });
  }

  return toDTO(message);
}
