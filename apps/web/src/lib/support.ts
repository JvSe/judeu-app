import type { SupportTicketCategory, SupportTicketStatus } from "@judeu/db";

import { prisma } from "./db";
import { notifyUser } from "./notifications";

// ---------------------------------------------------------------------------
// Central de ajuda/suporte + disputas (RF-H1/H2): usuário abre um chamado (dúvida
// geral ou contestação vinculada a um pedido), admin responde pelo painel — não há
// fila/atribuição, é um modelo simples de pergunta/resposta única por chamado.
// ---------------------------------------------------------------------------

export type SupportTicketDTO = {
  id: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminResponse: string | null;
  resolvedAt: string | null;
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
  resolvedAt: Date | null;
  createdAt: Date;
}): SupportTicketDTO {
  return {
    id: t.id,
    orderId: t.orderId,
    category: t.category,
    subject: t.subject,
    message: t.message,
    status: t.status,
    adminResponse: t.adminResponse,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
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
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { provider: { select: { userId: true } } },
    });
    if (!order) return { error: "Pedido não encontrado", status: 404 };
    const isParticipant = order.clientId === userId || order.provider?.userId === userId;
    if (!isParticipant) return { error: "Pedido não encontrado", status: 404 };
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      orderId: input.orderId,
      category: input.category,
      subject: input.subject,
      message: input.message,
    },
  });
  return toDTO(ticket);
}

export async function listMySupportTickets(userId: string): Promise<SupportTicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function getSupportTicket(
  userId: string,
  id: string,
): Promise<SupportTicketDTO | { error: string; status: number }> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || ticket.userId !== userId) {
    return { error: "Chamado não encontrado", status: 404 };
  }
  return toDTO(ticket);
}

// ---- Admin (painel web) ----

export type AdminSupportTicketDTO = SupportTicketDTO & {
  userName: string;
  userEmail: string;
};

export async function listAllSupportTickets(): Promise<AdminSupportTicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { fullName: true, email: true } } },
  });
  return rows.map((r) => ({ ...toDTO(r), userName: r.user.fullName, userEmail: r.user.email }));
}

export async function respondToSupportTicket(
  ticketId: string,
  response: string,
): Promise<void> {
  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { adminResponse: response, status: "RESOLVED", resolvedAt: new Date() },
    include: { user: { select: { role: true } } },
  });
  // Chamado não tem "outra parte" como pedido/chat — o role só decide em qual árvore
  // de telas (client/ ou provider/) navegar ao tocar a notificação (RF-I1).
  const role = ticket.user.role === "PROVIDER" ? "provider" : "client";
  void notifyUser(ticket.userId, "SUPPORT", {
    title: "Seu chamado foi respondido",
    body: response.length > 100 ? `${response.slice(0, 97)}...` : response,
    data: { type: "support", ticketId: ticket.id, role },
  });
}

export async function markSupportTicketInProgress(ticketId: string): Promise<void> {
  await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: "OPEN" },
    data: { status: "IN_PROGRESS" },
  });
}
