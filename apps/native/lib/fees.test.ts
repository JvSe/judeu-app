import { describe, expect, it } from "vitest";

import { percentLabel, previewOrderTotals } from "./fees";

describe("previewOrderTotals", () => {
  it("20% do ajudante: cliente paga o preço", () => {
    expect(previewOrderTotals(4000, { platformFeeRate: 0.2, feePayer: "PROVIDER" })).toEqual({
      platformFeeCents: 800,
      totalCents: 4000,
      providerNetCents: 3200,
    });
  });

  it("8% do cliente: soma ao total", () => {
    expect(previewOrderTotals(4000, { platformFeeRate: 0.08, feePayer: "CLIENT" })).toEqual({
      platformFeeCents: 320,
      totalCents: 4320,
      providerNetCents: 4000,
    });
  });
});

describe("percentLabel", () => {
  it("formata em pt-BR", () => {
    expect(percentLabel(0.2)).toBe("20%");
    expect(percentLabel(0.125)).toBe("12,5%");
  });
});
