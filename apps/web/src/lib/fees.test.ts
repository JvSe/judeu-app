import { describe, expect, it } from "vitest";

import { LEGACY_FEE_RULE, completionWalletMovement, computeFees, feeRuleOf, resolveFeeRule } from "./fees";

describe("computeFees", () => {
  it("regra legada (8% do cliente) reproduz o comportamento antigo", () => {
    expect(computeFees(4000, LEGACY_FEE_RULE)).toEqual({
      platformFeeCents: 320,
      totalCents: 4320,
      providerNetCents: 4000,
    });
  });

  it("20% do ajudante: cliente paga o preço, ajudante recebe 80%", () => {
    expect(computeFees(4000, { rate: 0.2, payer: "PROVIDER" })).toEqual({
      platformFeeCents: 800,
      totalCents: 4000,
      providerNetCents: 3200,
    });
  });

  it("arredonda centavos", () => {
    expect(computeFees(1999, { rate: 0.2, payer: "PROVIDER" }).platformFeeCents).toBe(400);
  });

  it("taxa zero", () => {
    expect(computeFees(5000, { rate: 0, payer: "PROVIDER" })).toEqual({
      platformFeeCents: 0,
      totalCents: 5000,
      providerNetCents: 5000,
    });
  });
});

describe("resolveFeeRule", () => {
  const config = { platformFeeRate: 0.2, feePayer: "PROVIDER" as const };

  it("usa a configuração quando a categoria não define taxa", () => {
    expect(resolveFeeRule(config, { feeRate: null })).toEqual({ rate: 0.2, payer: "PROVIDER" });
    expect(resolveFeeRule(config, null)).toEqual({ rate: 0.2, payer: "PROVIDER" });
  });

  it("taxa da categoria sobrescreve a geral", () => {
    expect(resolveFeeRule(config, { feeRate: 0.15 })).toEqual({ rate: 0.15, payer: "PROVIDER" });
  });
});

describe("feeRuleOf", () => {
  it("pedido antigo (sem colunas) fica com a regra legada", () => {
    expect(feeRuleOf({})).toEqual(LEGACY_FEE_RULE);
  });

  it("lê o snapshot do pedido", () => {
    expect(feeRuleOf({ feeRate: 0.2, feePayer: "PROVIDER" })).toEqual({ rate: 0.2, payer: "PROVIDER" });
  });
});

describe("completionWalletMovement", () => {
  const order = { priceCents: 4000, platformFeeCents: 800 };
  const provider = { rate: 0.2, payer: "PROVIDER" as const };

  it("legado, cartão pago: credita o preço cheio (como antes)", () => {
    expect(
      completionWalletMovement(LEGACY_FEE_RULE, { priceCents: 4000, platformFeeCents: 320 }, { method: "CARD", paid: true }),
    ).toMatchObject({ type: "CREDIT", amountCents: 4000 });
  });

  it("legado, dinheiro: credita o preço cheio (como antes)", () => {
    expect(
      completionWalletMovement(LEGACY_FEE_RULE, { priceCents: 4000, platformFeeCents: 320 }, { method: "CASH", paid: false }),
    ).toMatchObject({ type: "CREDIT", amountCents: 4000 });
  });

  it("20% do ajudante, cartão pago: credita preço − taxa", () => {
    expect(completionWalletMovement(provider, order, { method: "CARD", paid: true })).toMatchObject({
      type: "CREDIT",
      amountCents: 3200,
    });
  });

  it("20% do ajudante, dinheiro: debita a taxa", () => {
    expect(completionWalletMovement(provider, order, { method: "CASH", paid: false })).toMatchObject({
      type: "DEBIT",
      amountCents: 800,
    });
  });

  it("sem pagamento ou cartão não pago: nada", () => {
    expect(completionWalletMovement(provider, order, null)).toBeNull();
    expect(completionWalletMovement(provider, order, { method: "CARD", paid: false })).toBeNull();
  });
});
