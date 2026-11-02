import { randomUUID } from "node:crypto";

import type { Json, NotificationType } from "@judeu/db";

import { supabase } from "./db";
import { sendPushNotification } from "./push";

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
  data: unknown;
  readAt: string | null;
  createdAt: string;
}): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

export async function notifyUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("user")
      .select("notifyOrders, notifyMessages")
      .eq("id", userId)
      .maybeSingle();
    if (!user) return;
    const enabled =
      type === "ORDER" ? user.notifyOrders : type === "MESSAGE" ? user.notifyMessages : true;
    if (!enabled) return;

    await supabase.from("notification").insert({
      id: randomUUID(),
      userId,
      type,
      title: payload.title,
      body: payload.body,
      data: (payload.data as Json | undefined) ?? null,
    });
    void sendPushNotification(userId, payload);
  } catch {
    // Best-effort
  }
}

export async function listNotifications(
  userId: string,
): Promise<{ items: NotificationDTO[]; unreadCount: number }> {
  const [{ data: rows }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("notification")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(50),
    supabase
      .from("notification")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .is("readAt", null),
  ]);
  return { items: (rows ?? []).map(toDTO), unreadCount: unreadCount ?? 0 };
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<NotificationDTO | { error: string; status: number }> {
  const { data: existing } = await supabase.from("notification").select("*").eq("id", id).maybeSingle();
  if (!existing || existing.userId !== userId) {
    return { error: "Notificação não encontrada", status: 404 };
  }
  const { data: updated, error } = await supabase
    .from("notification")
    .update({ readAt: existing.readAt ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Falha");
  return toDTO(updated);
}

export async function markAllNotificationsRead(userId: string): Promise<{ count: number }> {
  const { data } = await supabase
    .from("notification")
    .update({ readAt: new Date().toISOString() })
    .eq("userId", userId)
    .is("readAt", null)
    .select("id");
  return { count: data?.length ?? 0 };
}

export type NotificationPreferencesDTO = { notifyOrders: boolean; notifyMessages: boolean };

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferencesDTO> {
  const { data, error } = await supabase
    .from("user")
    .select("notifyOrders, notifyMessages")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Usuário não encontrado");
  return data;
}

export async function setNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferencesDTO>,
): Promise<NotificationPreferencesDTO> {
  const { data, error } = await supabase
    .from("user")
    .update({ ...input, updatedAt: new Date().toISOString() })
    .eq("id", userId)
    .select("notifyOrders, notifyMessages")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha");
  return data;
}
