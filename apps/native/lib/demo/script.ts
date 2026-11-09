// Modo roteiro: sem o outro aparelho conectado, este aparelho simula o outro lado
// com atrasos realistas — a apresentação nunca fica parada esperando.
import { DEMO_CLIENT_ID, DEMO_HELPER_ID, firstName } from "./fixtures";
import { getState, isPaid, newId, record, type DemoOrder } from "./store";
import { TRAVEL_MS } from "./views";

const SCRIPTED_REQUEST = {
  description: "Preciso de ajuda para carregar umas caixas até o carro",
  priceCents: 6000,
};

function since(order: DemoOrder, now: number): number {
  return now - order.lastChangeAt;
}

function lastOrder(): DemoOrder | null {
  const list = Object.values(getState().orders).sort((a, b) => b.createdAt - a.createdAt);
  return list[0] ?? null;
}

/** Simula o ajudante (este aparelho é o do cliente). */
function playHelper(now: number): void {
  const o = lastOrder();
  if (!o) return;
  const t = since(o, now);
  const helperSaid = o.messages.some((m) => m.senderId === DEMO_HELPER_ID);
  switch (o.status) {
    case "CREATED":
      if (t >= 5000) record("transition", DEMO_HELPER_ID, { orderId: o.id, action: "accept" }, { scripted: true });
      return;
    case "ACCEPTED":
      if (!helperSaid && t >= 2500) {
        record(
          "message",
          DEMO_HELPER_ID,
          {
            orderId: o.id,
            messageId: newId("msg"),
            body: `Oi, ${firstName(DEMO_CLIENT_ID)}! Vi seu pedido e já posso ir. Chego em poucos minutos.`,
          },
          { scripted: true },
        );
        return;
      }
      if (isPaid(o) && t >= 3000) {
        record("transition", DEMO_HELPER_ID, { orderId: o.id, action: "start_route" }, { scripted: true });
      }
      return;
    case "EN_ROUTE":
      if (o.enRouteAt && now - o.enRouteAt >= TRAVEL_MS + 2500) {
        record("transition", DEMO_HELPER_ID, { orderId: o.id, action: "start_work" }, { scripted: true });
      }
      return;
    case "IN_PROGRESS":
      if (t >= 12_000) record("transition", DEMO_HELPER_ID, { orderId: o.id, action: "complete" }, { scripted: true });
      return;
    case "COMPLETED":
      if (!o.reviews.some((r) => r.authorId === DEMO_HELPER_ID) && t >= 4000) {
        record(
          "review",
          DEMO_HELPER_ID,
          { orderId: o.id, reviewId: newId("rev"), rating: 5, comment: "Pessoa muito atenciosa, recomendo!" },
          { scripted: true },
        );
      }
      return;
  }
}

/** Simula o cliente (este aparelho é o de quem atende). */
function playClient(now: number): void {
  const state = getState();
  const o = lastOrder();
  const openOrder = o && o.status !== "COMPLETED" && o.status !== "CANCELLED";

  if (!openOrder) {
    // Modo atender ligado há alguns segundos e nada no ar: chega um pedido novo.
    const onSince = state.helperAvailableAt;
    if (state.helperAvailable && onSince && now - onSince >= 4000 && (!o || o.createdAt < onSince)) {
      record(
        "order_created",
        DEMO_CLIENT_ID,
        {
          orderId: newId("demo"),
          description: SCRIPTED_REQUEST.description,
          priceCents: SCRIPTED_REQUEST.priceCents,
          categoryId: null,
          couponCode: null,
          discountCents: 0,
        },
        { scripted: true },
      );
    }
    if (o?.status === "COMPLETED" && !o.reviews.some((r) => r.authorId === DEMO_CLIENT_ID) && since(o, now) >= 4000) {
      record(
        "review",
        DEMO_CLIENT_ID,
        { orderId: o.id, reviewId: newId("rev"), rating: 5, comment: "Chegou rápido e foi super cuidadoso. Nota 10!" },
        { scripted: true },
      );
    }
    return;
  }

  const t = since(o, now);
  const clientSaid = o.messages.some((m) => m.senderId === DEMO_CLIENT_ID);
  switch (o.status) {
    case "ACCEPTED":
      if (!clientSaid && t >= 2500) {
        record(
          "message",
          DEMO_CLIENT_ID,
          { orderId: o.id, messageId: newId("msg"), body: "Oba, obrigado por aceitar! O portão é o azul." },
          { scripted: true },
        );
        return;
      }
      if (clientSaid && !o.payment && t >= 3000) {
        record(
          "payment",
          DEMO_CLIENT_ID,
          { orderId: o.id, paymentId: newId("pay"), method: "PIX", paid: true },
          { scripted: true },
        );
      }
      return;
    case "AWAITING_CONFIRMATION":
      if (t >= 5000) {
        record("transition", DEMO_CLIENT_ID, { orderId: o.id, action: "confirm_completion" }, { scripted: true });
      }
      return;
  }
}

export function runScriptTick(me: string, now = Date.now()): void {
  try {
    if (me === DEMO_HELPER_ID) playClient(now);
    else playHelper(now);
  } catch (err) {
    console.warn("[demo] roteiro falhou:", err);
  }
}
