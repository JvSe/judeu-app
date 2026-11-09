import { describe, expect, it } from "vitest";

import { LEGACY_FEE_RULE, MIN_TOTAL_AFTER_DISCOUNT_CENTS, completionWalletMovement, computeFees, feeRuleOf, resolveFeeRule } from "./fees";

describe("computeFees", () => {
  it("regra legada (8% do cliente) reproduz o comportamento antigo", () => {
    expect(computeFees(4000, LEGACY_FEE_RULE)).toEqual({
      platformFeeCents: 320,
      totalCents: 4320,
      providerNetCents: 4000,
      discountCents: 0,
    });
  });

  it("20% do ajudante: cliente paga o preço, ajudante recebe 80%", () => {
    expect(computeFees(4000, { rate: 0.2, payer: "PROVIDER" })).toEqual({
      platformFeeCents: 800,
      totalCents: 4000,
      providerNetCents: 3200,
      discountCents: 0,
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
      discountCents: 0,
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

describe("desconto (cupom + crédito)", () => {
  const RULE = { rate: 0.2, payer: "PROVIDER" as const };

  it("cliente paga menos, quem atende recebe o mesmo", () => {
    expect(computeFees(4000, RULE, 1000)).toEqual({
      platformFeeCents: 800,
      totalCents: 3000,
      providerNetCents: 3200,
      discountCents: 1000,
    });
  });

  it("nunca deixa o total abaixo de R$ 1", () => {
    const r = computeFees(4000, RULE, 99_999);
    expect(r.totalCents).toBe(MIN_TOTAL_AFTER_DISCOUNT_CENTS);
    expect(r.discountCents).toBe(3900);
  });

  it("cartão: repasse igual ao de sem desconto", () => {
    const order = { priceCents: 4000, platformFeeCents: 800, totalCents: 3000, discountCents: 1000 };
    expect(completionWalletMovement(RULE, order, { method: "CARD", paid: true })).toEqual({
      type: "CREDIT",
      amountCents: 3200,
      description: "Repasse de pedido concluído (já descontada a taxa)",
    });
  });

  it("dinheiro, desconto maior que a taxa: a plataforma devolve a diferença", () => {
    // Recebeu R$ 30 em mãos; o líquido dele é R$ 32 → crédito de R$ 2.
    const order = { priceCents: 4000, platformFeeCents: 800, totalCents: 3000, discountCents: 1000 };
    expect(completionWalletMovement(RULE, order, { method: "CASH", paid: false })).toEqual({
      type: "CREDIT",
      amountCents: 200,
      description: "Reembolso do desconto dado ao cliente",
    });
  });

  it("dinheiro, desconto menor que a taxa: deve só o resto da taxa", () => {
    // Recebeu R$ 35; o líquido dele é R$ 32 → deve R$ 3.
    const order = { priceCents: 4000, platformFeeCents: 800, totalCents: 3500, discountCents: 500 };
    expect(completionWalletMovement(RULE, order, { method: "CASH", paid: false })).toEqual({
      type: "DEBIT",
      amountCents: 300,
      description: "Taxa da plataforma (pedido recebido em dinheiro)",
    });
  });
});
