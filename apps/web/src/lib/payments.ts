import type { Prisma } from "@judeu/db";

import { prisma } from "./db";
import { stripe } from "./stripe";

// ---------------------------------------------------------------------------
// Pagamentos (RF-F1/F2): Stripe cobra o cliente na conta da plataforma.
// Sem Stripe Connect — o repasse ao prestador (RF-F3) é um ledger interno
// (Wallet/WalletTransaction), creditado quando o pedido é concluído.
// ---------------------------------------------------------------------------

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
  createdAt: Date;
}): PaymentDTO {
  return {
    id: p.id,
    orderId: p.orderId,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    createdAt: p.createdAt.toISOString(),
  };
}

type AuthorizedOrder = Prisma.OrderGetPayload<{
  include: { provider: { select: { userId: true } }; payment: true };
}>;

type LoadAuthorizedOrderResult =
  | { ok: true; order: AuthorizedOrder }
  | { ok: false; error: string; status: number };

async function loadAuthorizedOrder(
  userId: string,
  orderId: string,
  requireClient: boolean,
): Promise<LoadAuthorizedOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { provider: { select: { userId: true } }, payment: true },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado", status: 404 };

  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  if (requireClient && !isClient) {
    return { ok: false, error: "Ação permitida apenas ao cliente do pedido", status: 403 };
  }
  if (!requireClient && !isClient && !isProvider) {
    return { ok: false, error: "Você não participou deste pedido", status: 403 };
  }
  return { ok: true, order };
}

// Cria (ou substitui, se ainda não pago) o pagamento de um pedido.
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

  const amountCents = order.totalCents;

  if (method === "CASH") {
    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method: "CASH", status: "PENDING", amountCents },
      update: { method: "CASH", status: "PENDING", gatewayRef: null },
    });
    return { payment: toDTO(payment) };
  }

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { fullName: true, email: true },
  });

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
    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method: "PIX", status: "PENDING", amountCents, gatewayRef: intent.id },
      update: { method: "PIX", status: "PENDING", gatewayRef: intent.id },
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

  // CARD
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "brl",
    payment_method_types: ["card"],
  });
  const payment = await prisma.payment.upsert({
    where: { orderId },
    create: { orderId, method: "CARD", status: "PENDING", amountCents, gatewayRef: intent.id },
    update: { method: "CARD", status: "PENDING", gatewayRef: intent.id },
  });
  return { payment: toDTO(payment), clientSecret: intent.client_secret ?? undefined };
}

// Estado atual do pagamento; reconcilia com o Stripe se ainda estiver pendente
// (cobre rodar sem `stripe listen` local, sem depender só do webhook).
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
      payment = await prisma.payment.update({ where: { orderId }, data: { status: "PAID" } });
    } else if (intent.status === "canceled") {
      payment = await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    }
  }
  return { payment: toDTO(payment) };
}

export async function markPaidByGatewayRef(gatewayRef: string) {
  const payment = await prisma.payment.findFirst({ where: { gatewayRef } });
  if (!payment) return;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
}

export async function markFailedByGatewayRef(gatewayRef: string) {
  const payment = await prisma.payment.findFirst({ where: { gatewayRef } });
  if (!payment) return;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
}

// Repasse ao prestador (ledger interno — sem Stripe Connect).
export async function creditProviderWallet(providerUserId: string, amountCents: number, orderId: string) {
  if (amountCents <= 0) return;
  const wallet = await prisma.wallet.upsert({
    where: { userId: providerUserId },
    create: { userId: providerUserId, balanceCents: amountCents },
    update: { balanceCents: { increment: amountCents } },
  });
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "CREDIT",
      amountCents,
      description: "Repasse de pedido concluído",
      orderId,
    },
  });
}

// Estorna via Stripe se o pagamento já tiver sido capturado (Pix/cartão).
export async function refundIfPaid(orderId: string) {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment || payment.status !== "PAID" || payment.method === "CASH" || !payment.gatewayRef) {
    return;
  }
  await stripe.refunds.create({ payment_intent: payment.gatewayRef });
  await prisma.payment.update({ where: { orderId }, data: { status: "REFUNDED" } });
}
