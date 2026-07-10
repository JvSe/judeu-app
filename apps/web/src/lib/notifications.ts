import type { NotificationType, Prisma } from "@judeu/db";

import { prisma } from "./db";
import { sendPushNotification } from "./push";

// ---------------------------------------------------------------------------
// Centro de notificações in-app (RF-I1): persiste cada evento do domínio (novo
// pedido, transição de status, mensagem) que hoje já dispara push (RF-E2), e
// respeita a preferência do usuário por tipo de evento.
// ---------------------------------------------------------------------------

export type NotificationDTO = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

function toDTO(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

// Fire-and-forget nos call sites (orders.ts, chat.ts) — notificação é um extra,
// nunca deve derrubar o fluxo principal (mesmo padrão do push, RF-E2).
export async function notifyUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyOrders: true, notifyMessages: true },
    });
    if (!user) return;
    const enabled = type === "ORDER" ? user.notifyOrders : user.notifyMessages;
    if (!enabled) return;

    await prisma.notification.create({
      data: {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        data: (payload.data as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
    void sendPushNotification(userId, payload);
  } catch {
    // Best-effort — não deve derrubar criar pedido/enviar mensagem/etc.
  }
}

export async function listNotifications(
  userId: string,
): Promise<{ items: NotificationDTO[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: rows.map(toDTO), unreadCount };
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<NotificationDTO | { error: string; status: number }> {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Notificação não encontrada", status: 404 };
  }
  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: existing.readAt ?? new Date() },
  });
  return toDTO(updated);
}

export async function markAllNotificationsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}

export type NotificationPreferencesDTO = { notifyOrders: boolean; notifyMessages: boolean };

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferencesDTO> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { notifyOrders: true, notifyMessages: true },
  });
}

export async function setNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferencesDTO>,
): Promise<NotificationPreferencesDTO> {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: { notifyOrders: true, notifyMessages: true },
  });
}
