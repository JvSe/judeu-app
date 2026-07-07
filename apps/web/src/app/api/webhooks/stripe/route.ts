import { env } from "@judeu/env/server";

import { error, json } from "@/lib/http";
import { markFailedByGatewayRef, markPaidByGatewayRef } from "@/lib/payments";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// POST /api/webhooks/stripe — recebido pelo Stripe (não pelo app), sem auth de usuário.
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return error("Webhook não configurado", 400);
  }

  const body = await req.text();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return error("Assinatura inválida", 400);
  }

  if (event.type === "payment_intent.succeeded") {
    await markPaidByGatewayRef(event.data.object.id);
  } else if (event.type === "payment_intent.payment_failed") {
    await markFailedByGatewayRef(event.data.object.id);
  }

  return json({ received: true });
}
