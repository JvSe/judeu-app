import { describe, expect, it } from "vitest";

import { type Coupon, COUPON_MESSAGES, couponLabel, evaluateCoupon, normalizeCouponCode, planDiscount } from "./coupons";

const NOW = new Date("2026-11-09T12:00:00Z");
const NO_USE = { total: 0, byUser: 0, clientOrders: 0 };

function coupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    code: "BEMVINDO",
    kind: "PERCENT",
    value: 20,
    maxDiscountCents: null,
    minPriceCents: null,
    maxRedemptions: null,
    perUserLimit: 1,
    firstOrderOnly: false,
    startsAt: null,
    expiresAt: null,
    active: true,
    ...over,
  };
}

describe("evaluateCoupon", () => {
  it("percentual sobre o preço, com teto", () => {
    expect(evaluateCoupon(coupon(), 4000, NO_USE, NOW)).toEqual({ ok: true, discountCents: 800 });
    expect(evaluateCoupon(coupon({ maxDiscountCents: 500 }), 4000, NO_USE, NOW)).toEqual({ ok: true, discountCents: 500 });
  });

  it("valor fixo", () => {
    expect(evaluateCoupon(coupon({ kind: "FIXED", value: 1000 }), 4000, NO_USE, NOW)).toEqual({ ok: true, discountCents: 1000 });
  });

  it("recusas", () => {
    const err = (c: Coupon | null, usage = NO_USE, price = 4000) => {
      const r = evaluateCoupon(c, price, usage, NOW);
      return r.ok ? null : r.error;
    };
    expect(err(null)).toBe(COUPON_MESSAGES.NOT_FOUND);
    expect(err(coupon({ active: false }))).toBe(COUPON_MESSAGES.INACTIVE);
    expect(err(coupon({ startsAt: "2026-11-10T00:00:00Z" }))).toBe(COUPON_MESSAGES.NOT_STARTED);
    expect(err(coupon({ expiresAt: "2026-11-09T12:00:00Z" }))).toBe(COUPON_MESSAGES.EXPIRED);
    expect(err(coupon({ maxRedemptions: 10 }), { ...NO_USE, total: 10 })).toBe(COUPON_MESSAGES.SOLD_OUT);
    expect(err(coupon(), { ...NO_USE, byUser: 1 })).toBe(COUPON_MESSAGES.USER_LIMIT);
    expect(err(coupon({ firstOrderOnly: true }), { ...NO_USE, clientOrders: 2 })).toBe(COUPON_MESSAGES.FIRST_ORDER);
    expect(err(coupon({ minPriceCents: 5000 }))).toBe(COUPON_MESSAGES.MIN_PRICE(5000));
  });
});

describe("planDiscount", () => {
  it("cupom primeiro, crédito cobre o resto até o teto", () => {
    expect(planDiscount(3900, 800, 5000, true)).toEqual({ couponCents: 800, creditCents: 3100, totalCents: 3900 });
  });

  it("sem marcar 'usar créditos', não mexe no saldo", () => {
    expect(planDiscount(3900, 800, 5000, false)).toEqual({ couponCents: 800, creditCents: 0, totalCents: 800 });
  });

  it("cupom maior que o teto é cortado", () => {
    expect(planDiscount(500, 800, 0, true)).toEqual({ couponCents: 500, creditCents: 0, totalCents: 500 });
  });
});

describe("textos", () => {
  it("código normalizado e rótulo", () => {
    expect(normalizeCouponCode(" bem vindo ")).toBe("BEMVINDO");
    expect(couponLabel(coupon({ maxDiscountCents: 1500 }))).toBe("20% de desconto (até R$ 15,00)");
    expect(couponLabel(coupon({ kind: "FIXED", value: 1000 }))).toBe("R$ 10,00 de desconto");
  });
});
