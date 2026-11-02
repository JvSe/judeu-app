import { randomUUID } from "node:crypto";

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

  const row = order as unknown as AuthorizedOrder;
  const isClient = row.clientId === userId;
  const isProvider = row.provider?.userId === userId;
  if (requireClient && !isClient) {
    return { ok: false, error: "Ação permitida apenas ao cliente do pedido", status: 403 };
  }
  if (!requireClient && !isClient && !isProvider) {
    return { ok: false, error: "Você não participou deste pedido", status: 403 };
  }
  return { ok: true, order: row };
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
    .select("id")
    .eq("orderId", data.orderId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    const { data: payment, error } = await supabase
      .from("payment")
      .update({
        method: data.method,
        status: data.status,
        amountCents: data.amountCents,
        gatewayRef: data.gatewayRef ?? null,
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
  if (order.payment?.status === "PAID") {
    return { error: "Pedido já foi pago", status: 409 };
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
  let payment = loaded.order.payment;
  if (!payment) return { payment: null };

  if (payment.status === "PENDING" && payment.method !== "CASH" && payment.gatewayRef) {
    const intent = await stripe.paymentIntents.retrieve(payment.gatewayRef);
    if (intent.status === "succeeded") {
      const { data } = await supabase
        .from("payment")
        .update({ status: "PAID", updatedAt: new Date().toISOString() })
        .eq("orderId", orderId)
        .select("*")
        .single();
      payment = data;
      await notifyProviderIfNeeded(orderId);
    } else if (intent.status === "canceled") {
      const { data } = await supabase
        .from("payment")
        .update({ status: "FAILED", updatedAt: new Date().toISOString() })
        .eq("orderId", orderId)
        .select("*")
        .single();
      payment = data;
    }
  }
  return { payment: payment ? toDTO(payment) : null };
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

export async function creditProviderWallet(
  providerUserId: string,
  amountCents: number,
  orderId: string,
) {
  if (amountCents <= 0) return;
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
      .update({ balanceCents: existing.balanceCents + amountCents, updatedAt: now })
      .eq("id", walletId);
  } else {
    walletId = randomUUID();
    await supabase.from("wallet").insert({
      id: walletId,
      userId: providerUserId,
      balanceCents: amountCents,
      updatedAt: now,
    });
  }

  await supabase.from("wallettransaction").insert({
    id: randomUUID(),
    walletId,
    type: "CREDIT",
    amountCents,
    description: "Repasse de pedido concluído",
    orderId,
  });
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
