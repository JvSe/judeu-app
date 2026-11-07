import { describe, expect, it } from "vitest";

import { buildPayoutPreview, maskPixKey, normalizePixKey } from "./payouts";

describe("normalizePixKey", () => {
  it("CPF válido sem máscara; inválido recusado", () => {
    expect(normalizePixKey("CPF", "529.982.247-25")).toEqual({ key: "52998224725" });
    expect(normalizePixKey("CPF", "111.111.111-11")).toHaveProperty("error");
    expect(normalizePixKey("CPF", "529.982.247-24")).toHaveProperty("error");
  });
  it("CNPJ", () => {
    expect(normalizePixKey("CNPJ", "11.222.333/0001-81")).toEqual({ key: "11222333000181" });
    expect(normalizePixKey("CNPJ", "11.222.333/0001-80")).toHaveProperty("error");
  });
  it("e-mail, celular e aleatória", () => {
    expect(normalizePixKey("EMAIL", " Maria@Ex.com ")).toEqual({ key: "maria@ex.com" });
    expect(normalizePixKey("PHONE", "(63) 99999-1234")).toEqual({ key: "+5563999991234" });
    expect(normalizePixKey("PHONE", "+55 63 99999-1234")).toEqual({ key: "+5563999991234" });
    expect(normalizePixKey("PHONE", "9999")).toHaveProperty("error");
    expect(normalizePixKey("RANDOM", "123e4567-e89b-12d3-a456-426614174000")).toHaveProperty("key");
    expect(normalizePixKey("RANDOM", "abc")).toHaveProperty("error");
  });
});

describe("maskPixKey", () => {
  it("nunca mostra a chave inteira", () => {
    expect(maskPixKey("CPF", "52998224725")).toBe("***.982.247-**");
    expect(maskPixKey("EMAIL", "maria@ex.com")).toBe("ma***@ex.com");
    expect(maskPixKey("PHONE", "+5563999991234")).toBe("(63) *****-1234");
  });
});

describe("buildPayoutPreview", () => {
  const base = { balanceCents: 10_000, heldCents: 0, amountCents: 6_000, minCents: 1_000, feeCents: 0 };

  it("mostra como fica depois do saque", () => {
    expect(buildPayoutPreview(base)).toEqual({
      balanceCents: 10_000,
      heldCents: 0,
      availableCents: 10_000,
      amountCents: 6_000,
      feeCents: 0,
      netCents: 6_000,
      balanceAfterCents: 4_000,
      minCents: 1_000,
      error: null,
    });
  });

  it("valor em disputa fica retido", () => {
    const p = buildPayoutPreview({ ...base, heldCents: 5_000, amountCents: 6_000 });
    expect(p.availableCents).toBe(5_000);
    expect(p.error).toContain("R$ 50,00");
  });

  it("abaixo do mínimo", () => {
    expect(buildPayoutPreview({ ...base, amountCents: 500 }).error).toContain("mínimo");
  });

  it("tarifa sai do valor sacado", () => {
    expect(buildPayoutPreview({ ...base, feeCents: 150 })).toMatchObject({ netCents: 5_850, balanceAfterCents: 4_000 });
  });

  it("saldo negativo (taxas de dinheiro) bloqueia", () => {
    expect(buildPayoutPreview({ ...base, balanceCents: -800, amountCents: 1_000 }).error).toContain("taxas");
  });
});
