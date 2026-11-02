import { randomUUID } from "node:crypto";

import type { ProposalStatus } from "@judeu/db";

import { supabase } from "./db";
import { notifyUser } from "./notifications";
import { PLATFORM_FEE_RATE } from "./orders";

export type ProposalDTO = {
  id: string;
  byRole: "client" | "provider";
  priceCents: number;
  note: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
  clientAcceptedAt: string | null;
  providerAcceptedAt: string | null;
};

function toDTO(p: {
  id: string;
  byRole: string;
  priceCents: number;
  note: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
  clientAcceptedAt?: string | null;
  providerAcceptedAt?: string | null;
}): ProposalDTO {
  return {
    id: p.id,
    byRole: p.byRole as "client" | "provider",
    priceCents: p.priceCents,
    note: p.note,
    status: p.status,
    createdAt: p.createdAt,
    respondedAt: p.respondedAt,
    clientAcceptedAt: p.clientAcceptedAt ?? null,
    providerAcceptedAt: p.providerAcceptedAt ?? null,
  };
}

export function moneyLabel(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function computeAcceptedTotals(priceCents: number): {
  platformFeeCents: number;
  totalCents: number;
} {
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  return { platformFeeCents, totalCents: priceCents + platformFeeCents };
}

type NegotiableOrder = {
  id: string;
  clientId: string;
  status: string;
  isOpenRequest: boolean;
  provider: { userId: string; allowsNegotiation: boolean } | null;
  payment: { id: string; status?: string } | null;
  service: { name: string } | null;
  category: { name: string } | null;
};

async function findOrderForNegotiation(orderId: string): Promise<NegotiableOrder | null> {
  const { data } = await supabase
    .from("order")
    .select(
      `
      id, clientId, status, isOpenRequest,
      provider:providerprofile(userId, allowsNegotiation),
      payment:payment(id, status),
      service:service(name),
      category:category(name)
    `,
    )
    .eq("id", orderId)
    .maybeSingle();
  return data as unknown as NegotiableOrder | null;
}

async function loadNegotiableOrder(orderId: string, userId: string) {
  const order = await findOrderForNegotiation(orderId);
  if (!order) return { ok: false as const, error: "Pedido não encontrado", status: 404 };

  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  if (!isClient && !isProvider) {
    return { ok: false as const, error: "Você não participou deste pedido", status: 403 };
  }
  return { ok: true as const, order, isClient, isProvider };
}

function isOpenHelpNegotiation(order: NegotiableOrder): boolean {
  return (
    order.isOpenRequest &&
    order.status === "ACCEPTED" &&
    !!order.provider &&
    !order.payment
  );
}

function isProfessionalNegotiation(order: NegotiableOrder): boolean {
  return (
    order.status === "CREATED" &&
    !!order.provider?.allowsNegotiation &&
    !order.payment
  );
}

function canNegotiate(order: NegotiableOrder): boolean {
  return isOpenHelpNegotiation(order) || isProfessionalNegotiation(order);
}

/** True when open help has a pending price change awaiting dual confirmation. */
export async function hasBlockingOpenHelpProposal(orderId: string): Promise<boolean> {
  const { data } = await supabase
    .from("order")
    .select("id, isOpenRequest, status, payment:payment(id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return false;
  const order = data as unknown as {
    isOpenRequest: boolean;
    status: string;
    payment: { id: string } | null;
  };
  if (!order.isOpenRequest || order.status !== "ACCEPTED" || order.payment) return false;

  const { data: pending } = await supabase
    .from("orderproposal")
    .select("id")
    .eq("orderId", orderId)
    .eq("status", "PENDING")
    .maybeSingle();
  return !!pending;
}

export type CreateProposalInput = { priceCents: number; note?: string };

export async function createProposal(
  orderId: string,
  userId: string,
  input: CreateProposalInput,
): Promise<ProposalDTO | { error: string; status: number }> {
  const loaded = await loadNegotiableOrder(orderId, userId);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const { order, isClient, isProvider } = loaded;

  if (!canNegotiate(order)) {
    if (order.payment) {
      return {
        error: "Não é possível negociar: o pagamento deste pedido já foi iniciado",
        status: 409,
      };
    }
    if (order.isOpenRequest) {
      return {
        error: "Só é possível ajustar o valor depois do atendimento e antes do pagamento",
        status: 409,
      };
    }
    if (!order.provider?.allowsNegotiation) {
      return { error: "Este prestador não habilitou negociação de orçamento", status: 409 };
    }
    return { error: "Só é possível negociar o orçamento antes do aceite", status: 409 };
  }

  if (isOpenHelpNegotiation(order)) {
    if (!isClient) {
      return { error: "Só quem pediu a ajuda pode ajustar o valor", status: 403 };
    }
  }

  const byRole: "client" | "provider" = isClient ? "client" : "provider";
  if (!isClient && !isProvider) {
    return { error: "Você não participou deste pedido", status: 403 };
  }

  await supabase
    .from("orderproposal")
    .update({ status: "SUPERSEDED", clientAcceptedAt: null, providerAcceptedAt: null })
    .eq("orderId", orderId)
    .eq("status", "PENDING");

  const { data: proposal, error } = await supabase
    .from("orderproposal")
    .insert({
      id: randomUUID(),
      orderId,
      byRole,
      priceCents: input.priceCents,
      note: input.note?.trim() || null,
      clientAcceptedAt: null,
      providerAcceptedAt: null,
    })
    .select("*")
    .single();
  if (error || !proposal) throw new Error(error?.message ?? "Falha");

  const recipientId = isClient ? order.provider?.userId : order.clientId;
  if (recipientId) {
    void notifyUser(recipientId, "ORDER", {
      title: order.service?.name ?? order.category?.name ?? "Pedido",
      body: isOpenHelpNegotiation(order)
        ? `Novo valor proposto: ${moneyLabel(input.priceCents)}`
        : `Nova proposta de orçamento: ${moneyLabel(input.priceCents)}`,
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

  const { data: rows } = await supabase
    .from("orderproposal")
    .select("*")
    .eq("orderId", orderId)
    .order("createdAt", { ascending: false });
  return (rows ?? []).map(toDTO);
}

export async function respondToProposal(
  orderId: string,
  proposalId: string,
  userId: string,
  action: "accept" | "reject",
): Promise<ProposalDTO | { error: string; status: number }> {
  const { data: proposal } = await supabase
    .from("orderproposal")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal || proposal.orderId !== orderId) {
    return { error: "Proposta não encontrada", status: 404 };
  }

  const loaded = await loadNegotiableOrder(orderId, userId);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const { order, isClient, isProvider } = loaded;

  if (proposal.status !== "PENDING") {
    return { error: "Esta proposta já foi respondida", status: 409 };
  }
  if (!canNegotiate(order)) {
    return { error: "Não é possível negociar neste momento", status: 409 };
  }

  const now = new Date().toISOString();
  const openHelp = isOpenHelpNegotiation(order);

  if (action === "reject") {
    const { data: updated, error } = await supabase
      .from("orderproposal")
      .update({
        status: "REJECTED",
        respondedAt: now,
        clientAcceptedAt: null,
        providerAcceptedAt: null,
      })
      .eq("id", proposalId)
      .select("*")
      .single();
    if (error || !updated) throw new Error(error?.message ?? "Falha");

    const notifyId = isClient ? order.provider?.userId : order.clientId;
    if (notifyId) {
      void notifyUser(notifyId, "ORDER", {
        title: order.service?.name ?? order.category?.name ?? "Pedido",
        body: "O ajuste de valor foi recusado",
        data: {
          type: "order",
          orderId,
          role: isClient ? "provider" : "client",
        },
      });
    }
    return toDTO(updated);
  }

  // --- accept ---
  if (openHelp) {
    if (!proposal.clientAcceptedAt) {
      if (!isClient) {
        return { error: "Aguarde quem pediu aceitar o novo valor primeiro", status: 403 };
      }
      const { data: updated, error } = await supabase
        .from("orderproposal")
        .update({ clientAcceptedAt: now })
        .eq("id", proposalId)
        .select("*")
        .single();
      if (error || !updated) throw new Error(error?.message ?? "Falha");

      if (order.provider?.userId) {
        void notifyUser(order.provider.userId, "ORDER", {
          title: order.service?.name ?? order.category?.name ?? "Ajuda",
          body: `Valor de ${moneyLabel(proposal.priceCents)} confirmado pelo solicitante — sua vez de aceitar`,
          data: { type: "order", orderId, role: "provider" },
        });
      }
      return toDTO(updated);
    }

    if (!isProvider) {
      return { error: "Você já confirmou. Aguarde quem ajuda aceitar.", status: 403 };
    }

    const { platformFeeCents, totalCents } = computeAcceptedTotals(proposal.priceCents);
    const { data: updatedProposal, error } = await supabase
      .from("orderproposal")
      .update({
        status: "ACCEPTED",
        respondedAt: now,
        providerAcceptedAt: now,
      })
      .eq("id", proposalId)
      .select("*")
      .single();
    if (error || !updatedProposal) throw new Error(error?.message ?? "Falha");

    await supabase
      .from("order")
      .update({
        priceCents: proposal.priceCents,
        platformFeeCents,
        totalCents,
        updatedAt: now,
      })
      .eq("id", orderId);

    await supabase.from("orderevent").insert({
      id: randomUUID(),
      orderId,
      status: "ACCEPTED",
      note: `Valor ajustado: ${moneyLabel(proposal.priceCents)}`,
    });

    void notifyUser(order.clientId, "ORDER", {
      title: order.service?.name ?? order.category?.name ?? "Ajuda",
      body: `Quem ajuda aceitou ${moneyLabel(proposal.priceCents)}. Pode pagar.`,
      data: { type: "order", orderId, role: "client" },
    });

    return toDTO(updatedProposal);
  }

  // Professional: counterparty accepts in one step
  const responderRole: "client" | "provider" = isClient ? "client" : "provider";
  if (proposal.byRole === responderRole) {
    return { error: "Você não pode responder à própria proposta", status: 403 };
  }

  const { platformFeeCents, totalCents } = computeAcceptedTotals(proposal.priceCents);
  const { data: updatedProposal, error } = await supabase
    .from("orderproposal")
    .update({
      status: "ACCEPTED",
      respondedAt: now,
      clientAcceptedAt: isClient ? now : proposal.clientAcceptedAt,
      providerAcceptedAt: isProvider ? now : proposal.providerAcceptedAt,
    })
    .eq("id", proposalId)
    .select("*")
    .single();
  if (error || !updatedProposal) throw new Error(error?.message ?? "Falha");

  await supabase
    .from("order")
    .update({
      priceCents: proposal.priceCents,
      platformFeeCents,
      totalCents,
      updatedAt: now,
    })
    .eq("id", orderId);

  await supabase.from("orderevent").insert({
    id: randomUUID(),
    orderId,
    status: "CREATED",
    note: `Orçamento aceito: ${moneyLabel(proposal.priceCents)}`,
  });

  const recipientId = proposal.byRole === "client" ? order.clientId : order.provider?.userId;
  if (recipientId) {
    void notifyUser(recipientId, "ORDER", {
      title: order.service?.name ?? order.category?.name ?? "Pedido",
      body: `Sua proposta de ${moneyLabel(proposal.priceCents)} foi aceita`,
      data: { type: "order", orderId, role: proposal.byRole as "client" | "provider" },
    });
  }

  return toDTO(updatedProposal);
}
