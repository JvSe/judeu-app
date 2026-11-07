import { randomUUID } from "node:crypto";

import type { SupportTicketCategory, SupportTicketStatus } from "@judeu/db";

import { getConfig } from "./config";
import { supabase } from "./db";
import { slaDueAt } from "./moderation";
import { notifyUser } from "./notifications";

export type SupportTicketDTO = {
  id: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminResponse: string | null;
  resolvedAt: string | null;
  slaDueAt: string | null;
  createdAt: string;
};

function toDTO(t: {
  id: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminResponse: string | null;
  resolvedAt: string | null;
  slaDueAt?: string | null;
  createdAt: string;
}): SupportTicketDTO {
  return {
    id: t.id,
    orderId: t.orderId,
    category: t.category,
    subject: t.subject,
    message: t.message,
    status: t.status,
    adminResponse: t.adminResponse,
    resolvedAt: t.resolvedAt,
    slaDueAt: t.slaDueAt ?? null,
    createdAt: t.createdAt,
  };
}

export type CreateSupportTicketInput = {
  category: SupportTicketCategory;
  subject: string;
  message: string;
  orderId?: string;
};

export async function createSupportTicket(
  userId: string,
  input: CreateSupportTicketInput,
): Promise<SupportTicketDTO | { error: string; status: number }> {
  if (input.orderId) {
    const { data: order } = await supabase
      .from("order")
      .select("clientId, provider:providerprofile(userId)")
      .eq("id", input.orderId)
      .maybeSingle();
    if (!order) return { error: "Pedido não encontrado", status: 404 };
    const provider = order.provider as unknown as { userId: string } | null;
    const isParticipant = order.clientId === userId || provider?.userId === userId;
    if (!isParticipant) return { error: "Pedido não encontrado", status: 404 };
  }

  const { data: ticket, error } = await supabase
    .from("supportticket")
    .insert({
      id: randomUUID(),
      userId,
      orderId: input.orderId ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      // A coluna não tem default no banco: sem isto o insert dava 500 (QA C-02).
      updatedAt: new Date().toISOString(),
      slaDueAt: slaDueAt(input.category, new Date(), await getConfig()),
    })
    .select("*")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Falha");
  return toDTO(ticket);
}

export async function listMySupportTickets(userId: string): Promise<SupportTicketDTO[]> {
  const { data: rows } = await supabase
    .from("supportticket")
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false });
  return (rows ?? []).map(toDTO);
}

export async function getSupportTicket(
  userId: string,
  id: string,
): Promise<SupportTicketDTO | { error: string; status: number }> {
  const { data: ticket } = await supabase.from("supportticket").select("*").eq("id", id).maybeSingle();
  if (!ticket || ticket.userId !== userId) {
    return { error: "Chamado não encontrado", status: 404 };
  }
  return toDTO(ticket);
}

export type AdminSupportTicketDTO = SupportTicketDTO & {
  userName: string;
  userEmail: string;
};

export async function listAllSupportTickets(): Promise<AdminSupportTicketDTO[]> {
  const { data: rows } = await supabase
    .from("supportticket")
    .select("*, user:user!inner(fullName, email)")
    .order("status")
    .order("createdAt", { ascending: false });
  return (rows ?? []).map((r) => {
    const user = r.user as unknown as { fullName: string; email: string };
    return { ...toDTO(r), userName: user.fullName, userEmail: user.email };
  });
}

export async function respondToSupportTicket(ticketId: string, response: string): Promise<void> {
  const { data: ticket, error } = await supabase
    .from("supportticket")
    .update({
      adminResponse: response,
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select("*, user:user!inner(role)")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Falha");
  const user = ticket.user as unknown as { role: string };
  const role = user.role === "PROVIDER" ? "provider" : "client";
  void notifyUser(ticket.userId, "SUPPORT", {
    title: "Seu chamado foi respondido",
    body: response.length > 100 ? `${response.slice(0, 97)}...` : response,
    data: { type: "support", ticketId: ticket.id, role },
  });
}

export async function markSupportTicketInProgress(ticketId: string): Promise<void> {
  await supabase
    .from("supportticket")
    .update({ status: "IN_PROGRESS", updatedAt: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("status", "OPEN");
}
