// Monta as respostas no MESMO formato da API (apps/web) a partir do estado da demo.
import type {
  ChatMessage,
  NotificationItem,
  Order,
  Payment,
  Proposal,
  Review,
  WalletSummary,
} from "@/lib/api";
import { distanceKm } from "@/lib/nearby";

import {
  categoryName,
  clientHomeAddress,
  demoAppUser,
  DEMO_CLIENT_ID,
  DEMO_HELPER_ID,
  firstName,
  helperProviderId,
  helperRating,
  helperStartPoint,
} from "./fixtures";
import type { DemoEvent, DemoOrder, DemoState } from "./store";

/** Tempo do trajeto simulado (Iniciar caminho → chegou). */
export const TRAVEL_MS = 25_000;
// Mesmos valores de DEFAULT_APP_CONFIG (lib/api.ts) — copiados para não ler o
// módulo da API durante o carregamento (api.ts importa a demo: ciclo).
const FEE_RATE = 0.2;
const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

// ---- Trajeto simulado: "L" pelas quadras, do ponto de partida até o cliente ----

type Pt = { lat: number; lng: number };

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

let cachedRoute: Pt[] | null = null;
export function demoRoute(): Pt[] {
  if (cachedRoute) return cachedRoute;
  const start = helperStartPoint();
  const home = clientHomeAddress();
  const end = { lat: home.lat, lng: home.lng };
  const corner = { lat: start.lat, lng: end.lng };
  const pts: Pt[] = [];
  for (let i = 0; i <= 6; i++) pts.push(lerp(start, corner, i / 6));
  for (let i = 1; i <= 6; i++) pts.push(lerp(corner, end, i / 6));
  cachedRoute = pts;
  return pts;
}

function routeLength(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distanceKm(pts[i - 1], pts[i]);
  return total;
}

/** Ponto a uma fração `p` (0..1) do caminho + o resto da rota a partir dali. */
function along(pts: Pt[], p: number): { at: Pt; rest: Pt[] } {
  const total = routeLength(pts);
  let target = total * Math.min(1, Math.max(0, p));
  for (let i = 1; i < pts.length; i++) {
    const seg = distanceKm(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const at = seg > 0 ? lerp(pts[i - 1], pts[i], Math.min(1, target / seg)) : pts[i];
      return { at, rest: [at, ...pts.slice(i)] };
    }
    target -= seg;
  }
  const last = pts[pts.length - 1];
  return { at: last, rest: [last] };
}

function tracking(o: DemoOrder, now: number): Order["tracking"] {
  const none = { providerLat: null, providerLng: null, updatedAt: null, distanceKm: null, etaMin: null, route: null, arrived: false };
  if (!o.hasProvider || o.status === "CANCELLED") return none;
  const pts = demoRoute();
  const total = routeLength(pts);
  let progress = 0;
  if (o.status === "EN_ROUTE" && o.enRouteAt) progress = (now - o.enRouteAt) / TRAVEL_MS;
  if (o.status === "IN_PROGRESS" || o.status === "AWAITING_CONFIRMATION" || o.status === "COMPLETED") progress = 1;
  const { at, rest } = along(pts, progress);
  const remaining = total * (1 - Math.min(1, progress));
  const arrived = progress >= 1;
  return {
    providerLat: at.lat,
    providerLng: at.lng,
    updatedAt: iso(now),
    distanceKm: Math.round(remaining * 10) / 10,
    etaMin: arrived ? 0 : Math.max(1, Math.ceil(remaining / 0.25)),
    route: arrived ? null : rest,
    arrived,
  };
}

// ---- Pedido ----

function money(o: DemoOrder) {
  const platformFeeCents = Math.round(o.priceCents * FEE_RATE);
  return {
    priceCents: o.priceCents,
    platformFeeCents,
    totalCents: Math.max(0, o.priceCents - o.discountCents),
    feePayer: "PROVIDER" as const,
    feeRate: FEE_RATE,
    providerNetCents: o.priceCents - platformFeeCents,
  };
}

function clientStatsFrom(state: DemoState) {
  const mine = Object.values(state.orders).filter((x) => x.clientId === DEMO_CLIENT_ID);
  const ratings = mine.flatMap((x) => x.reviews.filter((r) => r.authorId === DEMO_HELPER_ID).map((r) => r.rating));
  return {
    completedOrders: mine.filter((x) => x.status === "COMPLETED").length,
    cancelledOrders: mine.filter((x) => x.status === "CANCELLED").length,
    totalOrders: mine.length,
    ratingAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
  };
}

export function orderView(state: DemoState, o: DemoOrder, viewerId: string, now = Date.now()): Order {
  const client = demoAppUser(o.clientId);
  const helper = demoAppUser(DEMO_HELPER_ID);
  const rating = helperRating();
  const catName = categoryName(o.categoryId);
  const stats = clientStatsFrom(state);
  return {
    id: o.id,
    status: o.status,
    description: o.description,
    scheduledAt: null,
    ...money(o),
    discountCents: o.discountCents,
    couponCode: o.couponCode,
    requiresDoorCode: true,
    riskLevel: 1,
    preferences: {},
    cancelReason: o.cancelReason,
    createdAt: iso(o.createdAt),
    offerExpiresAt: iso(o.createdAt + OPEN_REQUEST_TTL_MS),
    isOpenRequest: true,
    detailsReady: true,
    unreadMessages: o.messages.filter((m) => m.senderId !== viewerId && m.at > now - 60_000).length,
    service: null,
    category: o.categoryId && catName ? { id: o.categoryId, name: catName } : null,
    provider: o.hasProvider
      ? {
          id: helperProviderId(),
          name: helper.fullName,
          companyName: null,
          headline: null,
          avatarUrl: helper.avatarUrl,
          ratingAvg: rating.avg,
          allowsNegotiation: true,
        }
      : null,
    client: {
      id: client.id,
      name: client.fullName,
      phone: client.phone,
      avatarUrl: client.avatarUrl,
      createdAt: client.createdAt,
      phoneVerified: client.phoneVerified,
      emailVerified: client.emailVerified,
      ...stats,
    },
    payment: o.payment ? { status: o.payment.status, method: o.payment.method } : null,
    address: clientHomeAddress(),
    pickupAddress: null,
    events: o.timeline.map((t) => ({ status: t.status, note: t.note, createdAt: iso(t.at) })),
    tracking: tracking(o, now),
  };
}

export function ordersFor(state: DemoState, viewerId: string, as: "client" | "provider"): Order[] {
  const list = Object.values(state.orders)
    .filter((o) =>
      as === "client"
        ? o.clientId === viewerId
        : viewerId === DEMO_HELPER_ID && (o.hasProvider || o.status === "CREATED"),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return list.map((o) => orderView(state, o, viewerId));
}

export function messagesView(o: DemoOrder): ChatMessage[] {
  return o.messages.map((m) => ({
    id: m.id,
    orderId: o.id,
    senderId: m.senderId,
    senderName: demoAppUser(m.senderId).fullName,
    body: m.body,
    readAt: null,
    createdAt: iso(m.at),
  }));
}

export function proposalsView(o: DemoOrder): Proposal[] {
  return o.proposals.map((p) => ({
    id: p.id,
    byRole: p.byRole,
    priceCents: p.priceCents,
    note: p.note,
    status: p.status,
    createdAt: iso(p.createdAt),
    respondedAt: p.respondedAt ? iso(p.respondedAt) : null,
    clientAcceptedAt: p.clientAcceptedAt ? iso(p.clientAcceptedAt) : null,
    providerAcceptedAt: p.providerAcceptedAt ? iso(p.providerAcceptedAt) : null,
  }));
}

export function paymentView(o: DemoOrder): Payment | null {
  if (!o.payment) return null;
  return {
    id: o.payment.id,
    orderId: o.id,
    method: o.payment.method,
    status: o.payment.status,
    amountCents: money(o).totalCents,
    createdAt: iso(o.payment.at),
  };
}

export function reviewView(o: DemoOrder, authorId: string): Review | null {
  const r = o.reviews.find((x) => x.authorId === authorId);
  if (!r) return null;
  return {
    id: r.id,
    orderId: o.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: iso(r.at),
    author: { id: authorId, name: demoAppUser(authorId).fullName },
  };
}

// ---- Notificações: derivadas dos eventos, endereçadas ao "outro lado" ----

export function notificationFor(state: DemoState, ev: DemoEvent, viewerId: string): NotificationItem | null {
  if (ev.actor === viewerId) return null;
  const order = "orderId" in ev.payload ? state.orders[ev.payload.orderId] : undefined;
  const base = { id: ev.id, readAt: null, createdAt: iso(ev.at) };
  const helperName = firstName(DEMO_HELPER_ID);
  const clientName = firstName(DEMO_CLIENT_ID);
  const toHelper = viewerId === DEMO_HELPER_ID;

  switch (ev.type) {
    case "order_created":
      if (!toHelper || !order) return null;
      return {
        ...base,
        type: "ORDER",
        title: "Nova ajuda perto de você",
        body: `${ev.payload.description} · R$ ${(ev.payload.priceCents / 100).toFixed(2).replace(".", ",")}`,
        data: { type: "order", alert: "incoming_help", orderId: order.id, role: "provider" },
      };
    case "message":
      return {
        ...base,
        type: "MESSAGE",
        title: `Mensagem de ${toHelper ? clientName : helperName}`,
        body: ev.payload.body,
        data: { type: "chat", orderId: ev.payload.orderId },
      };
    case "payment":
    case "payment_paid":
      if (!toHelper || !order || !order.payment) return null;
      if (ev.type === "payment" && !ev.payload.paid && ev.payload.method !== "CASH") return null;
      return {
        ...base,
        type: "ORDER",
        title: order.payment.method === "CASH" ? "Pagamento em dinheiro no local" : "Pagamento confirmado",
        body: "Pode iniciar o trajeto.",
        data: { type: "order", orderId: order.id, role: "provider" },
      };
    case "transition": {
      const id = ev.payload.orderId;
      const map: Partial<Record<string, { to: "client" | "provider"; title: string; body: string; chat?: boolean }>> = {
        accept: { to: "client", title: `${helperName} aceitou sua ajuda`, body: "Combine os detalhes pelo chat.", chat: true },
        start_route: { to: "client", title: `${helperName} está a caminho`, body: "Acompanhe pelo mapa." },
        start_work: { to: "client", title: `${helperName} chegou`, body: "A ajuda começou." },
        complete: { to: "client", title: "Ajuda concluída", body: "Confirme a conclusão e avalie." },
        confirm_completion: { to: "provider", title: `${clientName} confirmou a conclusão`, body: "Valor creditado na sua carteira." },
      };
      const n = map[ev.payload.action];
      if (!n) return null;
      if ((n.to === "provider") !== toHelper) return null;
      return {
        ...base,
        type: "ORDER",
        title: n.title,
        body: n.body,
        data: n.chat ? { type: "chat", orderId: id } : { type: "order", orderId: id, role: n.to },
      };
    }
    default:
      return null;
  }
}

export function notificationsView(state: DemoState, viewerId: string, readIds: Set<string>) {
  const items: NotificationItem[] = [];
  for (const ev of state.events) {
    const n = notificationFor(state, ev, viewerId);
    if (n) items.push(readIds.has(n.id) ? { ...n, readAt: n.createdAt } : n);
  }
  items.reverse();
  return { notifications: items, unreadCount: items.filter((n) => !n.readAt).length };
}

// ---- Carteira de quem atende ----

export function walletView(state: DemoState): WalletSummary {
  const done = Object.values(state.orders)
    .filter((o) => o.hasProvider && o.status === "COMPLETED")
    .sort((a, b) => b.lastChangeAt - a.lastChangeAt);
  const transactions = done.map((o) => ({
    id: `tx-${o.id}`,
    type: "CREDIT" as const,
    amountCents: money(o).providerNetCents,
    description: `Ajuda: ${o.description}`,
    orderId: o.id,
    createdAt: iso(o.lastChangeAt),
  }));
  const balanceCents = transactions.reduce((sum, t) => sum + t.amountCents, 0);
  // Mesmo formato do servidor (apps/web/src/lib/wallet.ts): rótulo do dia da semana.
  const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const today = new Date();
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toDateString();
    const totalCents = transactions
      .filter((t) => new Date(t.createdAt).toDateString() === key)
      .reduce((sum, t) => sum + t.amountCents, 0);
    return { day: WEEKDAY_LABELS[d.getDay()], totalCents, isToday: i === 6 };
  });
  return { balanceCents, weekTotalCents: balanceCents, daily, transactions };
}
