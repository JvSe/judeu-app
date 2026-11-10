// Backend local do Modo Apresentação: responde às mesmas rotas da API (apps/web),
// no mesmo formato, sem rede. Só é usado quando um dos dois usuários demo está logado.
import bcrypt from "bcryptjs";

import type {
  CloudAssistantReply,
  CreateOrderInput,
  CreateProposalInput,
  CreateReviewInput,
  DiscountPreview,
  OrderAction,
  PaymentMethodOption,
} from "@/lib/api";
import { ApiError, DEFAULT_APP_CONFIG } from "@/lib/api";
import { getTokens } from "@/lib/tokens";

import {
  demoAddresses,
  demoAppUser,
  demoCategories,
  demoUserByEmail,
  DEMO_HELPER_ID,
  helperProfile,
  helperProviderId,
  helperRating,
  helperStartPoint,
  isDemoUserId,
} from "./fixtures";
import { demoToken, demoUserId, setDemoUser, userIdFromToken } from "./session";
import { getState, newId, record, transitionError, type DemoOrder } from "./store";
import {
  messagesView,
  notificationsView,
  orderView,
  ordersFor,
  paymentView,
  proposalsView,
  reviewView,
  walletView,
} from "./views";

type Opts = { method?: string; body?: unknown };
type Handled = { value: unknown };

const CREDIT_BALANCE_CENTS = 1000;
const readNotificationIds = new Set<string>();

function fail(message: string, status = 409): never {
  throw new ApiError(message, status);
}

function findOrder(id: string): DemoOrder {
  const order = getState().orders[id];
  if (!order) fail("Pedido não encontrado", 404);
  return order;
}

function role(order: DemoOrder, userId: string): "client" | "provider" {
  return order.clientId === userId ? "client" : "provider";
}

function discountFor(priceCents: number, couponCode?: string | null, useCredits?: boolean): DiscountPreview {
  const code = couponCode?.trim().toUpperCase() || null;
  const couponCents = code ? Math.min(1500, Math.round(priceCents * 0.1)) : 0;
  const creditCents = useCredits ? Math.min(CREDIT_BALANCE_CENTS, Math.max(0, priceCents - couponCents)) : 0;
  const discountCents = couponCents + creditCents;
  return {
    couponLabel: code ? `Cupom ${code} · 10%` : null,
    couponCents,
    creditCents,
    creditBalanceCents: CREDIT_BALANCE_CENTS,
    discountCents,
    totalCents: Math.max(0, priceCents - discountCents),
  };
}

function doorCodeFor(orderId: string): string {
  let h = 0;
  for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return String(h).padStart(4, "0");
}

function assistantReply(message: string): CloudAssistantReply {
  const text = message.toLowerCase();
  const category = demoCategories().find((c) => text.includes(c.name.toLowerCase().split(" ")[0]));
  return {
    reply:
      "Entendi! Posso publicar isso como um pedido de ajuda para quem está perto de você. " +
      "Confira a descrição e o valor sugerido antes de enviar.",
    action: {
      type: "help_request",
      description: message.trim(),
      categoryId: category?.id ?? null,
      priceCents: 6000,
      riskLevel: 1,
    },
    source: "keywords",
    conversationId: null,
  };
}

/**
 * Hash bcrypt copiado da conta real (scripts/demo-credentials.mjs). Acesso estático:
 * o Expo só embute `process.env.EXPO_PUBLIC_*` escrito por extenso.
 */
function demoPasswordHash(userId: string): string | null {
  const stored =
    userId === DEMO_HELPER_ID ? process.env.EXPO_PUBLIC_DEMO_HASH_HELPER : process.env.EXPO_PUBLIC_DEMO_HASH_CLIENT;
  return stored ? stored.replaceAll("_", "$") : null;
}

/**
 * Descobre se a chamada é da demo. O login só entra na demo com e-mail demo E a senha
 * dessa conta; sem isso segue para a API real, que valida a conta de verdade.
 */
async function resolveDemoUser(path: string, body: unknown): Promise<string | null> {
  if (path === "/api/auth/login") {
    const { email = "", password } = (body ?? {}) as { email?: string; password?: string };
    const userId = demoUserByEmail(email)?.id;
    if (!userId || !password) return null;
    const hash = demoPasswordHash(userId);
    if (!hash || !(await bcrypt.compare(password, hash))) return null;
    return userId;
  }
  const cached = demoUserId();
  if (cached) return cached;
  const tokens = await getTokens().catch(() => null);
  const fromToken = userIdFromToken(tokens?.accessToken);
  if (fromToken) setDemoUser(fromToken);
  return fromToken;
}

/**
 * Atende a requisição localmente quando a sessão é da demo.
 * Devolve null para seguir pela API real (qualquer outro usuário).
 */
export async function demoHandle(path: string, opts: Opts = {}): Promise<Handled | null> {
  const userId = await resolveDemoUser(path, opts.body);
  if (!userId || !isDemoUserId(userId)) return null;
  const value = route(userId, (opts.method ?? "GET").toUpperCase(), path, opts.body);
  return { value };
}

function route(me: string, method: string, fullPath: string, body: unknown): unknown {
  const [pathname, qs = ""] = fullPath.split("?");
  const query = new URLSearchParams(qs);
  const b = (body ?? {}) as Record<string, unknown>;
  const state = getState();
  const isHelper = me === DEMO_HELPER_ID;
  const seg = pathname.replace(/^\/api\//, "").split("/");
  const is = (m: string, pattern: string) => {
    if (m !== method) return false;
    const parts = pattern.split("/");
    return parts.length === seg.length && parts.every((p, i) => p.startsWith(":") || p === seg[i]);
  };

  // ---- Auth ----
  if (is("POST", "auth/login")) {
    setDemoUser(me);
    return { user: demoAppUser(me), accessToken: demoToken(me), refreshToken: demoToken(me) };
  }
  if (is("POST", "auth/refresh")) return { user: demoAppUser(me), accessToken: demoToken(me), refreshToken: demoToken(me) };
  if (is("POST", "auth/logout")) {
    setDemoUser(null);
    return { ok: true };
  }
  if (is("GET", "auth/me")) return { user: demoAppUser(me) };
  if (is("PATCH", "auth/me")) return { user: { ...demoAppUser(me), ...b } };
  if (is("GET", "auth/me/stats")) {
    const mine = Object.values(state.orders).filter((o) => o.clientId === me);
    return { stats: { completedOrders: mine.filter((o) => o.status === "COMPLETED").length, ratingAvg: null, ratingCount: 0 } };
  }
  if (is("GET", "auth/me/trusted-contact")) return { contact: null };
  if (is("PUT", "auth/me/trusted-contact")) return { contact: b.contact ?? null };

  // ---- Config, catálogo, endereços ----
  if (is("GET", "config")) return DEFAULT_APP_CONFIG;
  if (is("GET", "categories")) return { categories: demoCategories() };
  if (is("GET", "search")) {
    const q = (query.get("q") ?? "").toLowerCase();
    return { categories: demoCategories().filter((c) => c.name.toLowerCase().includes(q)), providers: [] };
  }
  if (is("GET", "addresses")) return { addresses: demoAddresses(me) };
  if (seg[0] === "addresses") {
    const first = demoAddresses(me)[0] ?? null;
    return method === "DELETE" ? { ok: true } : { address: first };
  }

  // ---- Quem atende ----
  if (is("GET", "providers/me")) return { profile: isHelper ? helperProfile(state.helperAvailable) : null };
  if (is("POST", "providers/me/availability")) {
    if (!isHelper) fail("Você não tem perfil de quem atende.", 403);
    const isAvailable = b.isAvailable === true;
    record("availability", me, { isAvailable });
    return { profile: helperProfile(isAvailable) };
  }
  if (seg[0] === "providers" && seg[1] === "me") return { profile: helperProfile(state.helperAvailable) };
  if (is("GET", "providers/nearby") || is("GET", "providers")) {
    const start = helperStartPoint();
    const rating = helperRating();
    const helper = demoAppUser(DEMO_HELPER_ID);
    return {
      providers: state.helperAvailable
        ? [
            {
              id: helperProviderId(),
              name: helper.fullName,
              companyName: null,
              role: null,
              avatarUrl: helper.avatarUrl,
              rating: rating.avg,
              reviews: rating.count,
              yearsExperience: 0,
              priceFromCents: null,
              baseLat: start.lat,
              baseLng: start.lng,
              lastLat: start.lat,
              lastLng: start.lng,
              serviceRadiusKm: 15,
              isAvailable: true,
              allowsNegotiation: true,
              distanceKm: 0.9,
              etaMin: 4,
            },
          ]
        : [],
    };
  }
  if (is("GET", "providers/:id/reviews")) return { reviews: [] };

  // ---- Pedidos: antes de criar ----
  if (is("GET", "orders/availability")) {
    return { count: 1, helpers: 1, professionals: 0, nearestKm: 0.9, etaMin: 4, area: { status: "OPEN", zoneName: "Palmas" } };
  }
  if (is("GET", "orders/suggested-price")) return { priceCents: 6000, source: "category_history", offHours: false };
  if (is("GET", "credits")) return { balanceCents: CREDIT_BALANCE_CENTS };
  if (is("POST", "orders/discount-preview")) {
    return discountFor(Number(b.priceCents) || 0, b.couponCode as string | undefined, b.useCredits === true);
  }

  // ---- Pedidos ----
  if (is("GET", "orders")) {
    return { orders: ordersFor(state, me, query.get("as") === "provider" ? "provider" : "client") };
  }
  if (is("POST", "orders")) {
    const input = b as CreateOrderInput;
    const priceCents = Math.max(100, Number(input.priceCents) || 6000);
    const discount = discountFor(priceCents, input.couponCode, input.useCredits);
    const orderId = newId("demo");
    record("order_created", me, {
      orderId,
      description: input.description?.trim() || "Pedido de ajuda",
      priceCents,
      categoryId: input.categoryId ?? null,
      couponCode: input.couponCode?.trim().toUpperCase() || null,
      discountCents: discount.discountCents,
    });
    return { order: orderView(getState(), findOrder(orderId), me) };
  }

  if (seg[0] === "orders" && seg[1]) {
    const order = findOrder(seg[1]);
    const view = () => ({ order: orderView(getState(), findOrder(order.id), me) });
    const sub = seg.slice(2).join("/");

    if (method === "GET" && sub === "") return view();
    if (method === "PATCH" && sub === "arrange") return view();
    if (method === "POST" && sub === "location") return view();
    if (method === "POST" && sub === "reassign") return view();
    if (sub === "share") return { share: null };
    if (sub === "emergency") return { ticketId: newId("ticket") };
    if (sub === "report") return { id: newId("report") };
    if (sub === "door-code") return { code: doorCodeFor(order.id), locked: false };

    if (method === "POST" && sub === "transition") {
      const action = b.action as OrderAction;
      const err = transitionError(order, action, me);
      if (err) fail(err);
      // Mesmas mensagens do servidor. O ajudante do roteiro não passa por aqui.
      if (action === "start_work") {
        const typed = String(b.doorCode ?? "").replace(/\D/g, "");
        if (!typed) fail("Peça à pessoa o código de chegada que aparece no app dela.");
        if (typed !== doorCodeFor(order.id)) {
          fail("Código incorreto. Confira com a pessoa o código que aparece no app dela.");
        }
      }
      record("transition", me, { orderId: order.id, action, note: (b.note as string | undefined) ?? null });
      return view();
    }

    if (sub === "messages") {
      if (method === "POST") {
        const text = String(b.body ?? "").trim();
        if (!text) fail("Mensagem vazia", 400);
        const messageId = newId("msg");
        record("message", me, { orderId: order.id, messageId, body: text });
        const msg = messagesView(findOrder(order.id)).find((m) => m.id === messageId);
        return { message: msg };
      }
      return { messages: messagesView(order) };
    }

    if (sub === "proposals") {
      if (method === "POST") {
        const input = b as CreateProposalInput;
        const proposalId = newId("prop");
        record("proposal", me, {
          orderId: order.id,
          proposalId,
          priceCents: Math.max(100, Number(input.priceCents) || order.priceCents),
          note: input.note ?? null,
          byRole: role(order, me),
        });
        return { proposal: proposalsView(findOrder(order.id)).find((p) => p.id === proposalId) };
      }
      return { proposals: proposalsView(order) };
    }
    if (method === "POST" && seg[2] === "proposals" && seg[4] === "respond") {
      const proposalId = seg[3];
      record("proposal_respond", me, {
        orderId: order.id,
        proposalId,
        action: b.action === "reject" ? "reject" : "accept",
        role: role(order, me),
      });
      return { proposal: proposalsView(findOrder(order.id)).find((p) => p.id === proposalId) };
    }

    if (sub === "payment") {
      if (method === "POST") {
        const method_ = (b.method as PaymentMethodOption) ?? "PIX";
        if (!order.payment || order.payment.status !== "PAID") {
          // Cartão aprova na hora (sem PaymentSheet); Pix confirma sozinho em ~3s; dinheiro no local.
          record("payment", me, { orderId: order.id, paymentId: newId("pay"), method: method_, paid: method_ === "CARD" });
          if (method_ === "PIX") {
            setTimeout(() => {
              const current = getState().orders[order.id];
              if (current?.payment && current.payment.status !== "PAID") record("payment_paid", me, { orderId: order.id });
            }, 3000);
          }
        }
        const fresh = findOrder(order.id);
        return {
          payment: paymentView(fresh),
          ...(method_ === "PIX" && fresh.payment?.status !== "PAID"
            ? {
                pix: {
                  data: `00020126580014BR.GOV.BCB.PIX0136${order.id}5204000053039865802BR5913JUDEU DEMO6006PALMAS62070503***6304DEMO`,
                  imageUrl: null,
                  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
                },
              }
            : {}),
        };
      }
      return { payment: paymentView(order) };
    }
    if (method === "POST" && sub === "payment/confirm") return { payment: paymentView(order) };

    if (sub === "review") {
      if (method === "POST") {
        const input = b as CreateReviewInput;
        record("review", me, {
          orderId: order.id,
          reviewId: newId("rev"),
          rating: Math.min(5, Math.max(1, Number(input.rating) || 5)),
          comment: input.comment?.trim() || null,
        });
        return { review: reviewView(findOrder(order.id), me) };
      }
      return { review: reviewView(order, me) };
    }
  }

  // ---- Carteira (simulada) ----
  if (is("GET", "wallet")) return { wallet: isHelper ? walletView(state) : walletView({ ...state, orders: {} }) };
  if (seg[0] === "wallet") {
    const balance = isHelper ? walletView(state).balanceCents : 0;
    const preview = {
      balanceCents: balance,
      heldCents: 0,
      availableCents: balance,
      amountCents: 0,
      feeCents: 0,
      netCents: 0,
      balanceAfterCents: balance,
      minCents: 1000,
      error: null,
    };
    if (pathname.endsWith("/preview")) return preview;
    if (seg[1] === "payouts" && method === "GET") return { simulated: true, account: null, preview, payouts: [] };
    return { ok: true, account: null, payout: null };
  }

  // ---- Notificações, push, suporte, vagas, IA ----
  if (is("GET", "notifications")) return notificationsView(state, me, readNotificationIds);
  if (is("POST", "notifications/read-all")) {
    const { notifications } = notificationsView(state, me, readNotificationIds);
    for (const n of notifications) readNotificationIds.add(n.id);
    return { ok: true, count: notifications.length };
  }
  if (is("POST", "notifications/:id/read")) {
    readNotificationIds.add(seg[1]);
    return { notification: notificationsView(state, me, readNotificationIds).notifications.find((n) => n.id === seg[1]) };
  }
  if (seg[0] === "notifications" && seg[1] === "preferences") {
    return { preferences: { notifyOrders: true, notifyMessages: true } };
  }
  if (is("POST", "push-token")) return { ok: true };
  if (is("GET", "support/tickets")) return { tickets: [] };
  if (seg[0] === "jobs") {
    if (method === "GET") return { jobs: [], applications: [], applicants: [] };
    fail("Vagas ficam fora da apresentação.", 400);
  }
  if (is("POST", "assistant")) return assistantReply(String(b.message ?? ""));

  console.warn(`[demo] rota sem resposta local: ${method} ${fullPath}`);
  return method === "GET" ? {} : { ok: true };
}
