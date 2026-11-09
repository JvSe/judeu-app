import { randomUUID } from "node:crypto";

import { type Coupon, type CouponUsage, couponLabel, evaluateCoupon, normalizeCouponCode, planDiscount } from "./coupons";
import { supabase } from "./db";
import { maxDiscountFor } from "./fees";

// Cupons e crédito do cliente no banco. O desconto é gravado no pedido
// (discountCents, couponId, creditUsedCents) e devolvido se ele for cancelado.

export async function findCoupon(code: string): Promise<Coupon | null> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  const { data } = await supabase.from("coupon").select("*").eq("code", normalized).maybeSingle();
  return (data as Coupon | null) ?? null;
}

async function couponUsage(couponId: string, userId: string): Promise<CouponUsage> {
  const [total, byUser, orders] = await Promise.all([
    supabase.from("couponredemption").select("id", { count: "exact", head: true }).eq("couponId", couponId),
    supabase
      .from("couponredemption")
      .select("id", { count: "exact", head: true })
      .eq("couponId", couponId)
      .eq("userId", userId),
    supabase
      .from("order")
      .select("id", { count: "exact", head: true })
      .eq("clientId", userId)
      .neq("status", "CANCELLED"),
  ]);
  return { total: total.count ?? 0, byUser: byUser.count ?? 0, clientOrders: orders.count ?? 0 };
}

/** Saldo de crédito do cliente (soma do livro). Sem a tabela, 0. */
export async function creditBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from("clientcredit").select("amountCents").eq("userId", userId);
  if (error) return 0;
  return Math.max(0, (data ?? []).reduce((sum, r) => sum + r.amountCents, 0));
}

export type DiscountPlan = {
  couponId: string | null;
  couponCode: string | null;
  couponLabel: string | null;
  couponCents: number;
  creditCents: number;
  totalCents: number;
};

export const NO_DISCOUNT: DiscountPlan = {
  couponId: null,
  couponCode: null,
  couponLabel: null,
  couponCents: 0,
  creditCents: 0,
  totalCents: 0,
};

/**
 * Desconto de um pedido novo. Cupom inválido é erro (o cliente digitou e
 * precisa saber); sem cupom e sem crédito, devolve desconto zero.
 */
export async function resolveDiscount(
  clientId: string,
  input: { couponCode?: string | null; useCredits?: boolean; priceCents: number; grossTotalCents: number },
  now = new Date(),
): Promise<DiscountPlan | { error: string; status: number }> {
  const code = input.couponCode ? normalizeCouponCode(input.couponCode) : "";
  if (!code && !input.useCredits) return NO_DISCOUNT;

  let coupon: Coupon | null = null;
  let couponCents = 0;
  if (code) {
    coupon = await findCoupon(code);
    const usage = coupon ? await couponUsage(coupon.id, clientId) : { total: 0, byUser: 0, clientOrders: 0 };
    const result = evaluateCoupon(coupon, input.priceCents, usage, now);
    if (!result.ok) return { error: result.error, status: 400 };
    couponCents = result.discountCents;
  }
  const balance = input.useCredits ? await creditBalance(clientId) : 0;
  const plan = planDiscount(maxDiscountFor(input.grossTotalCents), couponCents, balance, Boolean(input.useCredits));
  return {
    couponId: coupon?.id ?? null,
    couponCode: coupon?.code ?? null,
    couponLabel: coupon ? couponLabel(coupon) : null,
    ...plan,
  };
}

/** Grava o uso do cupom e o débito do crédito de um pedido recém-criado. */
export async function recordDiscountUse(orderId: string, clientId: string, plan: DiscountPlan): Promise<void> {
  if (plan.couponId && plan.couponCents > 0) {
    const { error } = await supabase.from("couponredemption").insert({
      id: randomUUID(),
      couponId: plan.couponId,
      userId: clientId,
      orderId,
      discountCents: plan.couponCents,
    });
    if (error) console.error(`[discounts] uso do cupom no pedido ${orderId}:`, error.message);
  }
  if (plan.creditCents > 0) {
    const { error } = await supabase.from("clientcredit").insert({
      id: randomUUID(),
      userId: clientId,
      amountCents: -plan.creditCents,
      kind: "USE",
      reason: "Usado num pedido",
      orderId,
    });
    if (error) console.error(`[discounts] débito de crédito no pedido ${orderId}:`, error.message);
  }
}

/**
 * Pedido cancelado: o cupom volta a valer e o crédito usado volta ao saldo.
 * Idempotente (a devolução é única por pedido no banco).
 */
export async function releaseOrderDiscounts(orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from("order")
    .select("clientId, creditUsedCents, couponId")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  if (order.couponId) await supabase.from("couponredemption").delete().eq("orderId", orderId);
  if (order.creditUsedCents > 0) {
    const { data: refunded } = await supabase
      .from("clientcredit")
      .select("id")
      .eq("orderId", orderId)
      .eq("kind", "REFUND")
      .maybeSingle();
    if (refunded) return;
    await supabase.from("clientcredit").insert({
      id: randomUUID(),
      userId: order.clientId,
      amountCents: order.creditUsedCents,
      kind: "REFUND",
      reason: "Devolvido: pedido cancelado",
      orderId,
    });
  }
}

export async function grantCredit(userId: string, amountCents: number, reason: string): Promise<void> {
  if (amountCents <= 0) return;
  const { error } = await supabase.from("clientcredit").insert({
    id: randomUUID(),
    userId,
    amountCents,
    kind: "GRANT",
    reason,
  });
  if (error) throw new Error(error.message);
}

// ---- Admin ----

export type AdminCouponDTO = Coupon & { redemptions: number; discountGivenCents: number; label: string };

export async function listCouponsWithUsage(): Promise<AdminCouponDTO[]> {
  const [{ data: coupons }, { data: uses }] = await Promise.all([
    supabase.from("coupon").select("*").order("createdAt", { ascending: false }),
    supabase.from("couponredemption").select("couponId, discountCents"),
  ]);
  const stats = new Map<string, { n: number; cents: number }>();
  for (const u of uses ?? []) {
    const s = stats.get(u.couponId) ?? { n: 0, cents: 0 };
    stats.set(u.couponId, { n: s.n + 1, cents: s.cents + u.discountCents });
  }
  return ((coupons ?? []) as Coupon[]).map((c) => ({
    ...c,
    redemptions: stats.get(c.id)?.n ?? 0,
    discountGivenCents: stats.get(c.id)?.cents ?? 0,
    label: couponLabel(c),
  }));
}

export async function createCoupon(input: Omit<Coupon, "id" | "active">): Promise<void> {
  const { error } = await supabase
    .from("coupon")
    .insert({ id: randomUUID(), ...input, code: normalizeCouponCode(input.code), active: true });
  if (error) throw new Error(error.message.includes("duplicate") ? "Já existe um cupom com esse código." : error.message);
}

export async function setCouponActive(couponId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("coupon").update({ active }).eq("id", couponId);
  if (error) throw new Error(error.message);
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from("user")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .is("deletedAt", null)
    .maybeSingle();
  return data?.id ?? null;
}

export async function listRecentCreditGrants(limit = 30) {
  const { data } = await supabase
    .from("clientcredit")
    .select("id, amountCents, reason, createdAt, user:user!inner(fullName, email)")
    .eq("kind", "GRANT")
    .order("createdAt", { ascending: false })
    .limit(limit);
  return (data ?? []).map((raw) => {
    const r = raw as typeof raw & {
      user: { fullName: string; email: string } | { fullName: string; email: string }[] | null;
    };
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    return {
      id: r.id,
      amountCents: r.amountCents,
      reason: r.reason,
      createdAt: r.createdAt,
      name: user?.fullName ?? "—",
      email: user?.email ?? "",
    };
  });
}
