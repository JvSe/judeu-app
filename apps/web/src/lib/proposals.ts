import type { ProposalStatus } from "@judeu/db";

import { prisma } from "./db";
import { notifyUser } from "./notifications";
import { PLATFORM_FEE_RATE } from "./orders";

// ---------------------------------------------------------------------------
// Orçamento/negociação antes do aceite (RF-D5): enquanto o pedido está CREATED
// e ainda não tem pagamento associado, cliente ou prestador podem propor um
// novo preço; a outra parte aceita (atualiza Order.priceCents) ou recusa.
// Recurso paralelo ao pedido — mesmo padrão de review.ts/chat.ts (rota própria,
// não embutido no OrderDTO).
// ---------------------------------------------------------------------------

export type ProposalDTO = {
  id: string;
  byRole: "client" | "provider";
  priceCents: number;
  note: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
};

function toDTO(p: {
  id: string;
  byRole: string;
  priceCents: number;
  note: string | null;
  status: ProposalStatus;
  createdAt: Date;
  respondedAt: Date | null;
}): ProposalDTO {
  return {
    id: p.id,
    byRole: p.byRole as "client" | "provider",
    priceCents: p.priceCents,
    note: p.note,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    respondedAt: p.respondedAt?.toISOString() ?? null,
  };
}

export function moneyLabel(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// Mesma fórmula de PLATFORM_FEE_RATE usada em createOrder (orders.ts) — reaplicada
// quando uma proposta é aceita, já que o preço do pedido muda.
export function computeAcceptedTotals(priceCents: number): {
  platformFeeCents: number;
  totalCents: number;
} {
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  return { platformFeeCents, totalCents: priceCents + platformFeeCents };
}

type NegotiableOrder = NonNullable<Awaited<ReturnType<typeof findOrderForNegotiation>>>;

function findOrderForNegotiation(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      provider: { select: { userId: true, allowsNegotiation: true } },
      payment: { select: { id: true } },
      service: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
}

type LoadNegotiableOrderResult =
  | { ok: true; order: NegotiableOrder; isClient: boolean; isProvider: boolean }
  | { ok: false; error: string; status: number };

async function loadNegotiableOrder(
  orderId: string,
  userId: string,
): Promise<LoadNegotiableOrderResult> {
  const order = await findOrderForNegotiation(orderId);
  if (!order) return { ok: false, error: "Pedido não encontrado", status: 404 };

  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  if (!isClient && !isProvider) {
    return { ok: false, error: "Você não participou deste pedido", status: 403 };
  }
  return { ok: true, order, isClient, isProvider };
}

export type CreateProposalInput = { priceCents: number; note?: string };

export async function createProposal(
  orderId: string,
  userId: string,
  input: CreateProposalInput,
): Promise<ProposalDTO | { error: string; status: number }> {
  const loaded = await loadNegotiableOrder(orderId, userId);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const { order, isClient } = loaded;

  if (!order.provider?.allowsNegotiation) {
    return { error: "Este prestador não habilitou negociação de orçamento", status: 409 };
  }
  if (order.status !== "CREATED") {
    return { error: "Só é possível negociar o orçamento antes do aceite", status: 409 };
  }
  if (order.payment) {
    return {
      error: "Não é possível negociar: o pagamento deste pedido já foi iniciado",
      status: 409,
    };
  }

  const byRole: "client" | "provider" = isClient ? "client" : "provider";

  const proposal = await prisma.$transaction(async (tx) => {
    await tx.orderProposal.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });
    return tx.orderProposal.create({
      data: { orderId, byRole, priceCents: input.priceCents, note: input.note?.trim() || null },
    });
  });

  const recipientId = isClient ? order.provider?.userId : order.clientId;
  if (recipientId) {
    void notifyUser(recipientId, "ORDER", {
      title: order.service?.name ?? order.category?.name ?? "Pedido",
      body: `Nova proposta de orçamento: ${moneyLabel(input.priceCents)}`,
      data: { type: "order", orderId, role: isClient ? "provider" : "client" },
    });
  }

  return toDTO(proposal);
}

export async function listProposals(
  orderId: string,
  userId: string,
): Promise<ProposalDTO[] | { error: string; status: number }> {
  const loaded = await loadNegotiableOrder(orderId, userId);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };

  const rows = await prisma.orderProposal.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function respondToProposal(
  orderId: string,
  proposalId: string,
  userId: string,
  action: "accept" | "reject",
): Promise<ProposalDTO | { error: string; status: number }> {
  const proposal = await prisma.orderProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.orderId !== orderId) {
    return { error: "Proposta não encontrada", status: 404 };
  }

  const loaded = await loadNegotiableOrder(orderId, userId);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const { order, isClient } = loaded;

  const responderRole: "client" | "provider" = isClient ? "client" : "provider";
  if (proposal.byRole === responderRole) {
    return { error: "Você não pode responder à própria proposta", status: 403 };
  }
  if (proposal.status !== "PENDING") {
    return { error: "Esta proposta já foi respondida", status: 409 };
  }
  if (order.status !== "CREATED") {
    return { error: "Só é possível negociar o orçamento antes do aceite", status: 409 };
  }

  const now = new Date();
  // Notifica quem propôs (está esperando resposta), não quem acabou de responder.
  const recipientId = proposal.byRole === "client" ? order.clientId : order.provider?.userId;

  if (action === "reject") {
    const updated = await prisma.orderProposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", respondedAt: now },
    });
    if (recipientId) {
      void notifyUser(recipientId, "ORDER", {
        title: order.service?.name ?? order.category?.name ?? "Pedido",
        body: "Sua proposta de orçamento foi recusada",
        data: { type: "order", orderId, role: proposal.byRole },
      });
    }
    return toDTO(updated);
  }

  // accept — recalcula taxa/total e atualiza o preço do pedido.
  const { platformFeeCents, totalCents } = computeAcceptedTotals(proposal.priceCents);

  const [updatedProposal] = await prisma.$transaction([
    prisma.orderProposal.update({
      where: { id: proposalId },
      data: { status: "ACCEPTED", respondedAt: now },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        priceCents: proposal.priceCents,
        platformFeeCents,
        totalCents,
        events: {
          create: { status: "CREATED", note: `Orçamento aceito: ${moneyLabel(proposal.priceCents)}` },
        },
      },
    }),
  ]);

  if (recipientId) {
    void notifyUser(recipientId, "ORDER", {
      title: order.service?.name ?? order.category?.name ?? "Pedido",
      body: `Sua proposta de ${moneyLabel(proposal.priceCents)} foi aceita`,
      data: { type: "order", orderId, role: proposal.byRole },
    });
  }

  return toDTO(updatedProposal);
}
