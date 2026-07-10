import { describe, expect, it } from "vitest";

import { PLATFORM_FEE_RATE, TRANSITIONS } from "./orders";

describe("PLATFORM_FEE_RATE", () => {
  it("é 8%", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.08);
  });

  it("bate com o exemplo verificado manualmente (R$60 -> taxa R$4,80 -> total R$64,80)", () => {
    const priceCents = 6000;
    const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
    const totalCents = priceCents + platformFeeCents;

    expect(platformFeeCents).toBe(480);
    expect(totalCents).toBe(6480);
  });
});

describe("TRANSITIONS (máquina de estados do pedido)", () => {
  it("espelha exatamente o fluxo documentado", () => {
    expect(TRANSITIONS).toEqual({
      accept: { from: ["CREATED"], to: "ACCEPTED", by: "provider" },
      reject: { from: ["CREATED"], to: "CANCELLED", by: "provider" },
      start_route: { from: ["ACCEPTED"], to: "EN_ROUTE", by: "provider" },
      start_work: { from: ["EN_ROUTE"], to: "IN_PROGRESS", by: "provider" },
      complete: { from: ["IN_PROGRESS"], to: "COMPLETED", by: "provider" },
      cancel: { from: ["CREATED", "ACCEPTED"], to: "CANCELLED", by: "client" },
    });
  });

  it("nenhuma transição sai de um estado terminal (COMPLETED/CANCELLED)", () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(rule.from).not.toContain("COMPLETED");
      expect(rule.from).not.toContain("CANCELLED");
    }
  });

  it("nenhuma transição é reflexiva (from nunca inclui o próprio to)", () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(rule.from).not.toContain(rule.to);
    }
  });

  it("só cliente ou prestador podem disparar uma transição", () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(["client", "provider"]).toContain(rule.by);
    }
  });

  it("cancelamento é a única ação que o cliente pode disparar", () => {
    const clientActions = Object.entries(TRANSITIONS).filter(([, rule]) => rule.by === "client");
    expect(clientActions).toEqual([["cancel", TRANSITIONS.cancel]]);
  });
});
