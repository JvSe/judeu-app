// Estado do Modo Apresentação como uma lista de eventos (event sourcing).
// O estado é sempre recalculado a partir dos eventos, então sincronizar os dois
// aparelhos é só juntar as listas (união por id) — reconexão e duplicata são triviais.
import { File, Paths } from "expo-file-system";

import type { OrderAction, OrderStatus, PaymentMethodOption } from "@/lib/api";

import { DEMO_HELPER_ID } from "./fixtures";

type Ev<T extends string, P> = {
  id: string;
  type: T;
  /** epoch ms do relógio de quem gerou */
  at: number;
  /** usuário que fez a ação (no modo roteiro, o "outro lado" simulado) */
  actor: string;
  scripted?: boolean;
  payload: P;
};

export type DemoEvent =
  | Ev<
      "order_created",
      {
        orderId: string;
        description: string;
        priceCents: number;
        categoryId: string | null;
        couponCode: string | null;
        discountCents: number;
      }
    >
  | Ev<"transition", { orderId: string; action: OrderAction; note?: string | null }>
  | Ev<"message", { orderId: string; messageId: string; body: string }>
  | Ev<"payment", { orderId: string; paymentId: string; method: PaymentMethodOption; paid: boolean }>
  | Ev<"payment_paid", { orderId: string }>
  | Ev<
      "proposal",
      { orderId: string; proposalId: string; priceCents: number; note: string | null; byRole: "client" | "provider" }
    >
  | Ev<"proposal_respond", { orderId: string; proposalId: string; action: "accept" | "reject"; role: "client" | "provider" }>
  | Ev<"review", { orderId: string; reviewId: string; rating: number; comment: string | null }>
  | Ev<"availability", { isAvailable: boolean }>;

export type DemoEventType = DemoEvent["type"];

export type DemoProposal = {
  id: string;
  byRole: "client" | "provider";
  priceCents: number;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  createdAt: number;
  respondedAt: number | null;
  clientAcceptedAt: number | null;
  providerAcceptedAt: number | null;
};

export type DemoOrder = {
  id: string;
  clientId: string;
  createdAt: number;
  description: string;
  priceCents: number;
  categoryId: string | null;
  couponCode: string | null;
  discountCents: number;
  status: OrderStatus;
  hasProvider: boolean;
  acceptedAt: number | null;
  enRouteAt: number | null;
  cancelReason: string | null;
  timeline: { status: OrderStatus; note: string | null; at: number }[];
  payment: { id: string; method: PaymentMethodOption; status: "PENDING" | "PAID"; at: number; paidAt: number | null } | null;
  messages: { id: string; senderId: string; body: string; at: number }[];
  proposals: DemoProposal[];
  reviews: { id: string; authorId: string; rating: number; comment: string | null; at: number }[];
  /** último evento que mexeu neste pedido (usado pelo modo roteiro) */
  lastChangeAt: number;
};

export type DemoState = {
  epoch: number;
  events: DemoEvent[];
  orders: Record<string, DemoOrder>;
  helperAvailable: boolean;
  helperAvailableAt: number | null;
};

// ---- Regras (espelham TRANSITIONS de apps/web/src/lib/orders.ts, sem as travas da demo) ----

const TRANSITIONS: Record<OrderAction, { from: OrderStatus[]; to: OrderStatus; by: "client" | "provider" }> = {
  accept: { from: ["CREATED"], to: "ACCEPTED", by: "provider" },
  reject: { from: ["CREATED"], to: "CANCELLED", by: "provider" },
  start_route: { from: ["ACCEPTED"], to: "EN_ROUTE", by: "provider" },
  start_work: { from: ["EN_ROUTE"], to: "IN_PROGRESS", by: "provider" },
  complete: { from: ["IN_PROGRESS"], to: "AWAITING_CONFIRMATION", by: "provider" },
  confirm_completion: { from: ["AWAITING_CONFIRMATION"], to: "COMPLETED", by: "client" },
  cancel: { from: ["CREATED", "ACCEPTED"], to: "CANCELLED", by: "client" },
};

export function isPaid(order: DemoOrder): boolean {
  return !!order.payment && (order.payment.status === "PAID" || order.payment.method === "CASH");
}

/** Motivo de recusa da transição, ou null se pode. */
export function transitionError(order: DemoOrder, action: OrderAction, actor: string): string | null {
  const rule = TRANSITIONS[action];
  if (!rule) return "Ação inválida";
  if (!rule.from.includes(order.status)) return "Esta ação não está disponível agora.";
  const isClient = actor === order.clientId;
  if (rule.by === "client" && !isClient) return "Só quem pediu pode fazer isso.";
  if (rule.by === "provider" && actor !== DEMO_HELPER_ID) return "Só quem atende pode fazer isso.";
  if (action === "start_route" && !isPaid(order)) return "Aguardando o pagamento.";
  return null;
}

function applyEvent(state: DemoState, ev: DemoEvent): void {
  if (ev.type === "availability") {
    if (ev.actor === DEMO_HELPER_ID) {
      state.helperAvailable = ev.payload.isAvailable;
      state.helperAvailableAt = ev.payload.isAvailable ? ev.at : null;
    }
    return;
  }
  if (ev.type === "order_created") {
    if (state.orders[ev.payload.orderId]) return;
    state.orders[ev.payload.orderId] = {
      id: ev.payload.orderId,
      clientId: ev.actor,
      createdAt: ev.at,
      description: ev.payload.description,
      priceCents: ev.payload.priceCents,
      categoryId: ev.payload.categoryId,
      couponCode: ev.payload.couponCode,
      discountCents: ev.payload.discountCents,
      status: "CREATED",
      hasProvider: false,
      acceptedAt: null,
      enRouteAt: null,
      cancelReason: null,
      timeline: [{ status: "CREATED", note: null, at: ev.at }],
      payment: null,
      messages: [],
      proposals: [],
      reviews: [],
      lastChangeAt: ev.at,
    };
    return;
  }

  const order = state.orders[ev.payload.orderId];
  if (!order) return;

  switch (ev.type) {
    case "transition": {
      if (transitionError(order, ev.payload.action, ev.actor)) return;
      const to = TRANSITIONS[ev.payload.action].to;
      order.status = to;
      order.timeline.push({ status: to, note: ev.payload.note ?? null, at: ev.at });
      if (ev.payload.action === "accept") {
        order.hasProvider = true;
        order.acceptedAt = ev.at;
      }
      if (ev.payload.action === "start_route") order.enRouteAt = ev.at;
      if (to === "CANCELLED") order.cancelReason = ev.payload.note ?? null;
      // Dinheiro no local: vira pago quando o cliente confirma a conclusão.
      if (ev.payload.action === "confirm_completion" && order.payment) {
        order.payment.status = "PAID";
        order.payment.paidAt = ev.at;
      }
      break;
    }
    case "message":
      if (order.messages.some((m) => m.id === ev.payload.messageId)) return;
      order.messages.push({ id: ev.payload.messageId, senderId: ev.actor, body: ev.payload.body, at: ev.at });
      break;
    case "payment":
      if (order.payment?.status === "PAID") return;
      order.payment = {
        id: ev.payload.paymentId,
        method: ev.payload.method,
        status: ev.payload.paid ? "PAID" : "PENDING",
        at: ev.at,
        paidAt: ev.payload.paid ? ev.at : null,
      };
      break;
    case "payment_paid":
      if (!order.payment || order.payment.status === "PAID") return;
      order.payment.status = "PAID";
      order.payment.paidAt = ev.at;
      break;
    case "proposal": {
      if (order.proposals.some((p) => p.id === ev.payload.proposalId)) return;
      for (const p of order.proposals) if (p.status === "PENDING") p.status = "SUPERSEDED";
      order.proposals.push({
        id: ev.payload.proposalId,
        byRole: ev.payload.byRole,
        priceCents: ev.payload.priceCents,
        note: ev.payload.note,
        status: "PENDING",
        createdAt: ev.at,
        respondedAt: null,
        clientAcceptedAt: ev.payload.byRole === "client" ? ev.at : null,
        providerAcceptedAt: ev.payload.byRole === "provider" ? ev.at : null,
      });
      break;
    }
    case "proposal_respond": {
      const p = order.proposals.find((x) => x.id === ev.payload.proposalId);
      if (!p || p.status !== "PENDING") return;
      if (ev.payload.action === "reject") {
        p.status = "REJECTED";
        p.respondedAt = ev.at;
        break;
      }
      if (ev.payload.role === "client") p.clientAcceptedAt ??= ev.at;
      else p.providerAcceptedAt ??= ev.at;
      if (p.clientAcceptedAt && p.providerAcceptedAt) {
        p.status = "ACCEPTED";
        p.respondedAt = ev.at;
        order.priceCents = p.priceCents;
      }
      break;
    }
    case "review":
      if (order.reviews.some((r) => r.authorId === ev.actor)) return;
      order.reviews.push({
        id: ev.payload.reviewId,
        authorId: ev.actor,
        rating: ev.payload.rating,
        comment: ev.payload.comment,
        at: ev.at,
      });
      break;
  }
  order.lastChangeAt = Math.max(order.lastChangeAt, ev.at);
}

function byTime(a: DemoEvent, b: DemoEvent): number {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function fold(epoch: number, events: DemoEvent[]): DemoState {
  const sorted = [...events].sort(byTime);
  const state: DemoState = { epoch, events: sorted, orders: {}, helperAvailable: false, helperAvailableAt: null };
  for (const ev of sorted) applyEvent(state, ev);
  return state;
}

// ---- Estado vivo + assinantes ----

export type StoreChange = { added: DemoEvent[]; source: "local" | "peer" | "reset" | "load" };

// Época 0 = instalação nova: dois aparelhos novos SOMAM os eventos ao conectar.
// Só o "Zerar rodada" cria época nova (e o outro aparelho adota a maior).
let state: DemoState = fold(0, []);
const listeners = new Set<(change: StoreChange) => void>();

export function getState(): DemoState {
  return state;
}

export function subscribe(fn: (change: StoreChange) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(change: StoreChange) {
  persistSoon();
  for (const fn of listeners) {
    try {
      fn(change);
    } catch (err) {
      console.warn("[demo] listener falhou:", err);
    }
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Registra uma ação feita neste aparelho (ou simulada pelo roteiro). */
export function record<E extends DemoEvent>(
  type: E["type"],
  actor: string,
  payload: E["payload"],
  opts: { scripted?: boolean } = {},
): DemoEvent {
  // Nunca antes do último evento conhecido: relógios dos dois aparelhos podem diferir
  // um pouco e um "aceite" não pode ficar ordenado antes do pedido que ele aceita.
  const last = state.events[state.events.length - 1];
  const at = Math.max(Date.now(), last ? last.at + 1 : 0);
  const ev = { id: newId("ev"), type, at, actor, payload, ...(opts.scripted ? { scripted: true } : {}) } as DemoEvent;
  state = fold(state.epoch, [...state.events, ev]);
  emit({ added: [ev], source: "local" });
  return ev;
}

/** Junta eventos vindos do outro aparelho. Época maior = o outro resetou; adota a dele. */
export function mergeRemote(epoch: number, events: DemoEvent[]): DemoEvent[] {
  if (epoch < state.epoch) return [];
  if (epoch > state.epoch) {
    state = fold(epoch, events);
    emit({ added: state.events, source: "reset" });
    return state.events;
  }
  const known = new Set(state.events.map((e) => e.id));
  const added = events.filter((e) => !known.has(e.id));
  if (added.length === 0) return [];
  state = fold(epoch, [...state.events, ...added]);
  emit({ added, source: "peer" });
  return added;
}

export function resetStore(epoch = Date.now()): void {
  state = fold(epoch, []);
  emit({ added: [], source: "reset" });
}

// ---- Persistência local (o app pode fechar no meio da apresentação) ----

const FILE_NAME = "judeu-demo-state.json";
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function stateFile(): File | null {
  try {
    return new File(Paths.document, FILE_NAME);
  } catch {
    return null;
  }
}

function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const file = stateFile();
      if (!file) return;
      if (!file.exists) file.create();
      file.write(JSON.stringify({ epoch: state.epoch, events: state.events }));
    } catch (err) {
      console.warn("[demo] não consegui salvar o estado:", err);
    }
  }, 300);
}

export function loadPersisted(): void {
  try {
    const file = stateFile();
    if (!file?.exists) return;
    const saved = JSON.parse(file.textSync()) as { epoch?: number; events?: DemoEvent[] };
    if (typeof saved.epoch !== "number" || !Array.isArray(saved.events)) return;
    state = fold(saved.epoch, saved.events);
    for (const fn of listeners) fn({ added: [], source: "load" });
  } catch (err) {
    console.warn("[demo] estado salvo ilegível, começando do zero:", err);
  }
}
