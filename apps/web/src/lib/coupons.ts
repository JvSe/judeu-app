// Cupons e crédito do cliente (Fase 6). Regras puras; o acesso ao banco fica em discounts.ts.

export type Coupon = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  maxDiscountCents: number | null;
  minPriceCents: number | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  firstOrderOnly: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
};

export type CouponUsage = {
  /** Usos do cupom por todo mundo. */
  total: number;
  /** Usos do cupom por este cliente. */
  byUser: number;
  /** Pedidos que o cliente já fez (não cancelados). */
  clientOrders: number;
};

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export const COUPON_MESSAGES = {
  NOT_FOUND: "Cupom não encontrado.",
  INACTIVE: "Este cupom não está mais valendo.",
  NOT_STARTED: "Este cupom ainda não começou a valer.",
  EXPIRED: "Este cupom venceu.",
  SOLD_OUT: "Este cupom já foi usado o máximo de vezes.",
  USER_LIMIT: "Você já usou este cupom.",
  FIRST_ORDER: "Este cupom vale só no primeiro pedido.",
  MIN_PRICE: (min: number) => `Este cupom vale para pedidos a partir de R$ ${(min / 100).toFixed(2).replace(".", ",")}.`,
} as const;

/** Desconto que o cupom dá sobre o preço do serviço, ou o motivo de não valer. */
export function evaluateCoupon(
  coupon: Coupon | null,
  priceCents: number,
  usage: CouponUsage,
  now: Date,
): { ok: true; discountCents: number } | { ok: false; error: string } {
  if (!coupon) return { ok: false, error: COUPON_MESSAGES.NOT_FOUND };
  if (!coupon.active) return { ok: false, error: COUPON_MESSAGES.INACTIVE };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) {
    return { ok: false, error: COUPON_MESSAGES.NOT_STARTED };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, error: COUPON_MESSAGES.EXPIRED };
  }
  if (coupon.maxRedemptions != null && usage.total >= coupon.maxRedemptions) {
    return { ok: false, error: COUPON_MESSAGES.SOLD_OUT };
  }
  if (usage.byUser >= coupon.perUserLimit) return { ok: false, error: COUPON_MESSAGES.USER_LIMIT };
  if (coupon.firstOrderOnly && usage.clientOrders > 0) return { ok: false, error: COUPON_MESSAGES.FIRST_ORDER };
  if (coupon.minPriceCents != null && priceCents < coupon.minPriceCents) {
    return { ok: false, error: COUPON_MESSAGES.MIN_PRICE(coupon.minPriceCents) };
  }
  let discount = coupon.kind === "PERCENT" ? Math.round((priceCents * Math.min(coupon.value, 100)) / 100) : coupon.value;
  if (coupon.maxDiscountCents != null) discount = Math.min(discount, coupon.maxDiscountCents);
  return { ok: true, discountCents: Math.max(0, discount) };
}

/**
 * Divide o desconto entre cupom e crédito, respeitando o teto (o total não
 * fica abaixo do mínimo). O cupom vem primeiro; o crédito cobre o resto.
 */
export function planDiscount(
  maxDiscountCents: number,
  couponCents: number,
  creditBalanceCents: number,
  useCredits: boolean,
): { couponCents: number; creditCents: number; totalCents: number } {
  const coupon = Math.min(Math.max(0, couponCents), maxDiscountCents);
  const credit = useCredits ? Math.min(Math.max(0, creditBalanceCents), maxDiscountCents - coupon) : 0;
  return { couponCents: coupon, creditCents: credit, totalCents: coupon + credit };
}

export function couponLabel(c: Pick<Coupon, "kind" | "value" | "maxDiscountCents">): string {
  if (c.kind === "PERCENT") {
    const cap = c.maxDiscountCents != null ? ` (até R$ ${(c.maxDiscountCents / 100).toFixed(2).replace(".", ",")})` : "";
    return `${c.value}% de desconto${cap}`;
  }
  return `R$ ${(c.value / 100).toFixed(2).replace(".", ",")} de desconto`;
}
