import { describe, expect, it } from "vitest";

import { computeAcceptedTotals, moneyLabel } from "./proposals";

describe("moneyLabel", () => {
  it("formata centavos em reais com vírgula", () => {
    expect(moneyLabel(6000)).toBe("R$ 60,00");
    expect(moneyLabel(6480)).toBe("R$ 64,80");
    expect(moneyLabel(100)).toBe("R$ 1,00");
  });
});

describe("computeAcceptedTotals", () => {
  it("bate com o mesmo exemplo verificado em orders.test.ts (R$60 -> taxa R$4,80 -> total R$64,80)", () => {
    expect(computeAcceptedTotals(6000)).toEqual({ platformFeeCents: 480, totalCents: 6480, discountCents: 0 });
  });

  it("nunca gera um total menor que o preço proposto", () => {
    for (const priceCents of [100, 999, 15000, 123456]) {
      const { platformFeeCents, totalCents } = computeAcceptedTotals(priceCents);
      expect(platformFeeCents).toBeGreaterThanOrEqual(0);
      expect(totalCents).toBe(priceCents + platformFeeCents);
    }
  });
});

describe("computeAcceptedTotals com a regra do pedido", () => {
  it("20% do ajudante: total = preço", () => {
    expect(computeAcceptedTotals(6000, { rate: 0.2, payer: "PROVIDER" })).toEqual({
      platformFeeCents: 1200,
      totalCents: 6000,
      discountCents: 0,
    });
  });

  it("o desconto do pedido continua valendo no novo preço", () => {
    expect(computeAcceptedTotals(6000, { rate: 0.2, payer: "PROVIDER" }, 1000)).toEqual({
      platformFeeCents: 1200,
      totalCents: 5000,
      discountCents: 1000,
    });
  });
});
