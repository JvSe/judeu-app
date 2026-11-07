import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { supabase } from "./db";
import { notifyUser } from "./notifications";
import { stripe } from "./stripe";

async function hasBlockingOpenHelpProposal(orderId: string): Promise<boolean> {
  const { data: order } = await supabase
    .from("order")
    .select("isOpenRequest, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.isOpenRequest || order.status !== "ACCEPTED") return false;

  const { data: payment } = await supabase
    .from("payment")
    .select("id")
    .eq("orderId", orderId)
    .maybeSingle();
  if (payment) return false;

  const { data: pending } = await supabase
    .from("orderproposal")
    .select("id")
    .eq("orderId", orderId)
    .eq("status", "PENDING")
    .maybeSingle();
  return !!pending;
}

export type PaymentMethodInput = "PIX" | "CARD" | "CASH";

export type PaymentDTO = {
  id: string;
  orderId: string;
  method: PaymentMethodInput;
  status: "PENDING" | "PAID" | "REFUNDED" | "FAILED";
  amountCents: number;
  createdAt: string;
};

export type PixDisplay = { data: string; imageUrl: string | null; expiresAt: string | null };

function toDTO(p: {
  id: string;
  orderId: string;
  method: PaymentMethodInput;
  status: PaymentDTO["status"];
  amountCents: number;
  createdAt: string;
}): PaymentDTO {
  return {
    id: p.id,
    orderId: p.orderId,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    createdAt: p.createdAt,
  };
}

type AuthorizedOrder = {
  id: string;
  clientId: string;
  status: string;
  totalCents: number;
  provider: { userId: string } | null;
  payment: {
    id: string;
    orderId: string;
    method: PaymentMethodInput;
    status: PaymentDTO["status"];
    amountCents: number;
    gatewayRef: string | null;
    createdAt: string;
    updatedAt?: string;
  } | null;
};

async function loadAuthorizedOrder(
  userId: string,
  orderId: string,
  requireClient: boolean,
): Promise<{ ok: true; order: AuthorizedOrder } | { ok: false; error: string; status: number }> {
  const { data: order } = await supabase
    .from("order")
    .select("*, provider:providerprofile(userId), payment:payment(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido não encontrado", status: 404 };

  const row = order as unknown as AuthorizedOrder & {
    payment?: AuthorizedOrder["payment"] | AuthorizedOrder["payment"][];
    provider?: AuthorizedOrder["provider"] | AuthorizedOrder["provider"][];
  };
  // PostgREST às vezes devolve relação 1:1 como array — normaliza.
  const payment = Array.isArray(row.payment) ? (row.payment[0] ?? null) : (row.payment ?? null);
  const provider = Array.isArray(row.provider) ? (row.provider[0] ?? null) : (row.provider ?? null);
  const normalized: AuthorizedOrder = { ...row, payment, provider };

  const isClient = normalized.clientId === userId;
  const isProvider = normalized.provider?.userId === userId;
  if (requireClient && !isClient) {
    return { ok: false, error: "Ação permitida apenas ao cliente do pedido", status: 403 };
  }
  if (!requireClient && !isClient && !isProvider) {
    return { ok: false, error: "Você não participou deste pedido", status: 403 };
  }
  return { ok: true, order: normalized };
}

async function upsertPayment(data: {
  orderId: string;
  method: PaymentMethodInput;
  status: PaymentDTO["status"];
  amountCents: number;
  gatewayRef?: string | null;
}) {
  const { data: existing } = await supabase
    .from("payment")
    .select("*")
    .eq("orderId", data.orderId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    // Nunca rebaixa um pagamento já confirmado.
    if (existing.status === "PAID") return existing;
    const { data: payment, error } = await supabase
      .from("payment")
      .update({
        method: data.method,
        status: data.status,
        amountCents: data.amountCents,
        gatewayRef: data.gatewayRef ?? existing.gatewayRef,
        updatedAt: now,
      })
      .eq("orderId", data.orderId)
      .select("*")
      .single();
    if (error || !payment) throw new Error(error?.message ?? "Falha no payment");
    return payment;
  }
  const { data: payment, error } = await supabase
    .from("payment")
    .insert({
      id: randomUUID(),
      orderId: data.orderId,
      method: data.method,
      status: data.status,
      amountCents: data.amountCents,
      gatewayRef: data.gatewayRef ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .select("*")
    .single();
  if (error || !payment) throw new Error(error?.message ?? "Falha no payment");
  return payment;
}

type PaymentRow = NonNullable<AuthorizedOrder["payment"]>;

/** Intent ainda pode ser aberto no PaymentSheet / Pix QR. */
const REUSABLE_INTENT = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

/** Stripe já comprometeu a cobrança — grava PAID no app (inclui `processing`). */
function intentMeansPaid(status: string): boolean {
  return status === "succeeded" || status === "processing";
}

async function markPaymentStatus(
  orderId: string,
  status: PaymentDTO["status"],
): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from("payment")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("orderId", orderId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao atualizar status do pagamento");
  }
  return data as PaymentRow;
}

async function markPaidFromIntent(
  orderId: string,
  intentId: string,
  payment: PaymentRow,
): Promise<PaymentRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payment")
    .update({
      status: "PAID",
      gatewayRef: intentId,
      updatedAt: now,
    })
    .eq("orderId", orderId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao marcar pagamento como PAID");
  }
  await notifyProviderIfNeeded(orderId);
  return data as PaymentRow;
}

/** Procura intent já pago deste pedido — metadata ou recuperação por valor recente. */
async function findPaidIntentForOrder(
  orderId: string,
  payment: PaymentRow,
): Promise<Stripe.PaymentIntent | null> {
  try {
    const listed = await stripe.paymentIntents.list({ limit: 40 });
    const byMeta = listed.data.find(
      (intent) =>
        intentMeansPaid(intent.status) && intent.metadata?.orderId === orderId,
    );
    if (byMeta) return byMeta;

    // Pedidos antigos sem metadata: um único succeeded no mesmo valor após o payment.
    const createdSec = Math.floor(new Date(payment.createdAt).getTime() / 1000) - 120;
    const candidates = listed.data.filter(
      (intent) =>
        intentMeansPaid(intent.status) &&
        intent.amount === payment.amountCents &&
        intent.created >= createdSec &&
        (!payment.gatewayRef || intent.id !== payment.gatewayRef),
    );
    if (candidates.length === 1) return candidates[0];
    // Também aceita o próprio gatewayRef se a lista já refletir succeeded (race).
    return (
      listed.data.find(
        (intent) => intent.id === payment.gatewayRef && intentMeansPaid(intent.status),
      ) ?? null
    );
  } catch {
    return null;
  }
}

/** Alinha PENDING com o Stripe — evita cobrir de novo um intent já pago. */
async function reconcilePendingWithStripe(
  orderId: string,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.status === "PAID" || payment.method === "CASH") return payment;
  if (payment.status !== "PENDING") return payment;

  try {
    if (payment.gatewayRef) {
      let intent = await stripe.paymentIntents.retrieve(payment.gatewayRef);

      if (intent.status === "requires_capture") {
        intent = await stripe.paymentIntents.capture(payment.gatewayRef);
      }

      if (intentMeansPaid(intent.status)) {
        return await markPaidFromIntent(orderId, intent.id, payment);
      }
      if (intent.status === "canceled") {
        // Pode existir outro intent pago do mesmo pedido (cobrança anterior).
        const paidOther = await findPaidIntentForOrder(orderId, payment);
        if (paidOther) return await markPaidFromIntent(orderId, paidOther.id, payment);
        return await markPaymentStatus(orderId, "FAILED");
      }

      // gatewayRef aponta pra intent não pago, mas pode haver outro já succeeded.
      if (REUSABLE_INTENT.has(intent.status)) {
        const paidOther = await findPaidIntentForOrder(orderId, payment);
        if (paidOther) return await markPaidFromIntent(orderId, paidOther.id, payment);
      }
    }

    const paidOther = await findPaidIntentForOrder(orderId, payment);
    if (paidOther) return await markPaidFromIntent(orderId, paidOther.id, payment);
  } catch {
    // Mantém PENDING se o Stripe falhar pontualmente — o confirm/poll tenta de novo.
  }
  return payment;
}

export async function createOrUpdatePayment(
  clientId: string,
  orderId: string,
  method: PaymentMethodInput,
): Promise<
  | { payment: PaymentDTO; clientSecret?: string; pix?: PixDisplay }
  | { error: string; status: number }
> {
  const loaded = await loadAuthorizedOrder(clientId, orderId, true);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const { order } = loaded;

  if (order.status === "CANCELLED") {
    return { error: "Pedido cancelado, não é possível pagar", status: 409 };
  }

  // Idempotente: se já pagou (ou o Stripe já confirmou), devolve PAID sem nova cobrança.
  let existing = order.payment;
  if (existing) {
    existing = await reconcilePendingWithStripe(orderId, existing);
    if (existing.status === "PAID" || existing.method === "CASH") {
      return { payment: toDTO(existing) };
    }
  }

  if (await hasBlockingOpenHelpProposal(orderId)) {
    return {
      error: "Há um ajuste de valor pendente. Ambos precisam aceitar antes de pagar.",
      status: 409,
    };
  }

  const amountCents = order.totalCents;

  if (method === "CASH") {
    const payment = await upsertPayment({
      orderId,
      method: "CASH",
      status: "PENDING",
      amountCents,
      gatewayRef: null,
    });
    await notifyCanStart(orderId, "O cliente vai pagar em dinheiro no local");
    return { payment: toDTO(payment) };
  }

  // Reusa o PaymentIntent pendente — NUNCA cria outro enquanto houver um aberto/pago.
  if (existing && existing.status === "PENDING" && existing.gatewayRef) {
    const intent = await stripe.paymentIntents.retrieve(existing.gatewayRef);
    if (intentMeansPaid(intent.status) || intent.status === "requires_capture") {
      const synced = await reconcilePendingWithStripe(orderId, existing);
      if (synced.status === "PAID") return { payment: toDTO(synced) };
    }
    if (REUSABLE_INTENT.has(intent.status) && existing.method === method) {
      if (method === "CARD") {
        return {
          payment: toDTO(existing),
          clientSecret: intent.client_secret ?? undefined,
        };
      }
      if (method === "PIX") {
        const qr = intent.next_action?.pix_display_qr_code;
        return {
          payment: toDTO(existing),
          pix: qr?.data
            ? {
                data: qr.data,
                imageUrl: qr.image_url_png ?? null,
                expiresAt: qr.expires_at
                  ? new Date(qr.expires_at * 1000).toISOString()
                  : null,
              }
            : undefined,
        };
      }
    }
    if (intent.status !== "canceled") {
      // Não cria cobrança nova (evita sobrescrever gatewayRef de um intent já autorizado).
      return {
        error: `Pagamento em andamento no Stripe (${intent.status}). Aguarde a confirmação.`,
        status: 409,
      };
    }
  }

  const { data: client } = await supabase
    .from("user")
    .select("fullName, email")
    .eq("id", clientId)
    .maybeSingle();

  if (method === "PIX") {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "brl",
      payment_method_types: ["pix"],
      payment_method_data: {
        type: "pix",
        billing_details: { name: client?.fullName, email: client?.email },
      },
      confirm: true,
      metadata: { orderId },
    });
    const payment = await upsertPayment({
      orderId,
      method: "PIX",
      status: "PENDING",
      amountCents,
      gatewayRef: intent.id,
    });
    const qr = intent.next_action?.pix_display_qr_code;
    return {
      payment: toDTO(payment),
      pix:
        qr?.data
          ? {
              data: qr.data,
              imageUrl: qr.image_url_png ?? null,
              expiresAt: qr.expires_at ? new Date(qr.expires_at * 1000).toISOString() : null,
            }
          : undefined,
    };
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "brl",
    payment_method_types: ["card"],
    metadata: { orderId },
  });
  const payment = await upsertPayment({
    orderId,
    method: "CARD",
    status: "PENDING",
    amountCents,
    gatewayRef: intent.id,
  });
  return { payment: toDTO(payment), clientSecret: intent.client_secret ?? undefined };
}

export async function getPayment(
  userId: string,
  orderId: string,
): Promise<{ payment: PaymentDTO | null } | { error: string; status: number }> {
  const loaded = await loadAuthorizedOrder(userId, orderId, false);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const payment = loaded.order.payment;
  if (!payment) return { payment: null };

  const synced = await reconcilePendingWithStripe(orderId, payment);
  return { payment: toDTO(synced) };
}

/** Usado ao listar/buscar pedido — grava PAID se o Stripe já confirmou. */
export async function syncOrderPaymentStatus(orderId: string): Promise<void> {
  const { data: payment } = await supabase
    .from("payment")
    .select("*")
    .eq("orderId", orderId)
    .maybeSingle();
  if (!payment) return;
  if (payment.status === "PAID" || payment.method === "CASH") return;
  if (payment.status !== "PENDING") return;
  await reconcilePendingWithStripe(orderId, payment as PaymentRow);
}

/**
 * Confirmação explícita após PaymentSheet (cartão) / poll Pix.
 * Força reconciliação com o Stripe e devolve o status atual.
 */
export async function confirmPayment(
  userId: string,
  orderId: string,
): Promise<{ payment: PaymentDTO } | { error: string; status: number }> {
  const loaded = await loadAuthorizedOrder(userId, orderId, true);
  if (!loaded.ok) return { error: loaded.error, status: loaded.status };
  const payment = loaded.order.payment;
  if (!payment) {
    return { error: "Nenhum pagamento iniciado para este pedido", status: 404 };
  }
  if (payment.status === "PAID" || payment.method === "CASH") {
    return { payment: toDTO(payment) };
  }

  const synced = await reconcilePendingWithStripe(orderId, payment);
  if (synced.status === "PAID") {
    return { payment: toDTO(synced) };
  }
  if (synced.status === "FAILED") {
    return { error: "O pagamento falhou. Tente novamente.", status: 409 };
  }

  // Ainda PENDING: inclui o status do Stripe na mensagem pra depurar.
  let stripeStatus = "desconhecido";
  if (synced.gatewayRef) {
    try {
      const intent = await stripe.paymentIntents.retrieve(synced.gatewayRef);
      stripeStatus = intent.status;
    } catch {
      stripeStatus = "indisponível";
    }
  }
  return {
    error: `Pagamento ainda não confirmado no Stripe (${stripeStatus}).`,
    status: 409,
  };
}

async function notifyCanStart(orderId: string, body: string) {
  const { data: order } = await supabase
    .from("order")
    .select("id, provider:providerprofile(userId)")
    .eq("id", orderId)
    .maybeSingle();
  const provider = order?.provider as unknown as { userId: string } | null;
  if (!provider) return;
  void notifyUser(provider.userId, "ORDER", {
    title: "Pode iniciar o trajeto",
    body,
    data: { type: "order", orderId: order!.id, role: "provider" },
  });
}

async function notifyProviderIfNeeded(orderId: string) {
  await notifyCanStart(orderId, "Pagamento confirmado");
}

export async function markPaidByGatewayRef(gatewayRef: string) {
  const { data: payment } = await supabase
    .from("payment")
    .select("*")
    .eq("gatewayRef", gatewayRef)
    .maybeSingle();
  if (!payment || payment.status === "PAID") return;
  await supabase
    .from("payment")
    .update({ status: "PAID", updatedAt: new Date().toISOString() })
    .eq("id", payment.id);
  await notifyProviderIfNeeded(payment.orderId);
}

export async function markFailedByGatewayRef(gatewayRef: string) {
  const { data: payment } = await supabase
    .from("payment")
    .select("*")
    .eq("gatewayRef", gatewayRef)
    .maybeSingle();
  if (!payment) return;
  await supabase
    .from("payment")
    .update({ status: "FAILED", updatedAt: new Date().toISOString() })
    .eq("id", payment.id);
}

/**
 * Lança um movimento na carteira de quem atende (CREDIT soma, DEBIT subtrai —
 * o saldo pode ficar negativo quando a taxa de um pedido em dinheiro é devida).
 */
export async function applyWalletMovement(
  providerUserId: string,
  movement: { type: "CREDIT" | "DEBIT"; amountCents: number; description: string },
  orderId: string,
) {
  if (movement.amountCents <= 0) return;
  const delta = movement.type === "CREDIT" ? movement.amountCents : -movement.amountCents;
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("wallet")
    .select("*")
    .eq("userId", providerUserId)
    .maybeSingle();

  let walletId: string;
  if (existing) {
    walletId = existing.id;
    await supabase
      .from("wallet")
      .update({ balanceCents: existing.balanceCents + delta, updatedAt: now })
      .eq("id", walletId);
  } else {
    walletId = randomUUID();
    await supabase.from("wallet").insert({
      id: walletId,
      userId: providerUserId,
      balanceCents: delta,
      updatedAt: now,
    });
  }

  await supabase.from("wallettransaction").insert({
    id: randomUUID(),
    walletId,
    type: movement.type,
    amountCents: movement.amountCents,
    description: movement.description,
    orderId,
  });
}

export async function creditProviderWallet(
  providerUserId: string,
  amountCents: number,
  orderId: string,
) {
  await applyWalletMovement(
    providerUserId,
    { type: "CREDIT", amountCents, description: "Repasse de pedido concluído" },
    orderId,
  );
}

export async function refundIfPaid(orderId: string) {
  const { data: payment } = await supabase
    .from("payment")
    .select("*")
    .eq("orderId", orderId)
    .maybeSingle();
  if (!payment || payment.status !== "PAID" || payment.method === "CASH" || !payment.gatewayRef) {
    return;
  }
  await stripe.refunds.create({ payment_intent: payment.gatewayRef });
  await supabase
    .from("payment")
    .update({ status: "REFUNDED", updatedAt: new Date().toISOString() })
    .eq("orderId", orderId);
}
