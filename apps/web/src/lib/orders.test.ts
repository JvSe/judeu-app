import { describe, expect, it } from "vitest";

import {
  isInsideServiceRadius,
  matchesOpenRequestAudience,
  OFFER_TTL_MS,
  OPEN_REQUEST_TTL_MS,
  PLATFORM_FEE_RATE,
  TRANSITIONS,
  type OpenRequestAudienceProfile,
} from "./orders";

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
      complete: { from: ["IN_PROGRESS"], to: "AWAITING_CONFIRMATION", by: "provider" },
      confirm_completion: { from: ["AWAITING_CONFIRMATION"], to: "COMPLETED", by: "client" },
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

  it("cancelamento e confirmação de conclusão são as únicas ações que o cliente pode disparar", () => {
    const clientActions = Object.entries(TRANSITIONS).filter(([, rule]) => rule.by === "client");
    expect(clientActions).toEqual([
      ["confirm_completion", TRANSITIONS.confirm_completion],
      ["cancel", TRANSITIONS.cancel],
    ]);
  });
});

describe("isInsideServiceRadius", () => {
  const origin = { lat: -10.1841, lng: -48.3336 };

  it("sem origem não entra no raio", () => {
    expect(isInsideServiceRadius(null, 10, origin)).toBe(false);
  });

  it("o próprio ponto está dentro; um ponto longe não", () => {
    expect(isInsideServiceRadius(origin, 10, origin)).toBe(true);
    expect(isInsideServiceRadius(origin, 10, { lat: -23.55, lng: -46.63 })).toBe(false);
  });
});

describe("oferta vs solicitação aberta", () => {
  it("chamada dirigida expira em 60s; solicitação aberta fica no ar por 4h", () => {
    expect(OFFER_TTL_MS).toBe(60_000);
    expect(OPEN_REQUEST_TTL_MS).toBe(4 * 60 * 60 * 1000);
  });
});

describe("matchesOpenRequestAudience", () => {
  const origin = { lat: -10.1841, lng: -48.3336 };
  const nearby = { lat: -10.185, lng: -48.334 };
  const far = { lat: -23.55, lng: -46.63 };

  function profile(
    overrides: Partial<OpenRequestAudienceProfile> = {},
  ): OpenRequestAudienceProfile {
    return {
      id: "p1",
      userId: "u1",
      isHelper: false,
      serviceRadiusKm: 10,
      lastLat: origin.lat,
      lastLng: origin.lng,
      lastLocationAt: new Date().toISOString(),
      baseLat: origin.lat,
      baseLng: origin.lng,
      categories: [{ categoryId: "cat-reparos" }],
      ...overrides,
    };
  }

  it("bloqueia prestador ocupado", () => {
    expect(
      matchesOpenRequestAudience(profile(), { categoryId: "cat-reparos", address: nearby }, new Set(["p1"])),
    ).toBe(false);
  });

  it("bloqueia fora do raio", () => {
    expect(
      matchesOpenRequestAudience(profile(), { categoryId: "cat-reparos", address: far }, new Set()),
    ).toBe(false);
  });

  it("helper no raio recebe qualquer categoria", () => {
    expect(
      matchesOpenRequestAudience(
        profile({ isHelper: true, categories: [] }),
        { categoryId: "cat-frete", address: nearby },
        new Set(),
      ),
    ).toBe(true);
  });

  it("profissional só recebe categoria compatível", () => {
    expect(
      matchesOpenRequestAudience(profile(), { categoryId: "cat-reparos", address: nearby }, new Set()),
    ).toBe(true);
    expect(
      matchesOpenRequestAudience(profile(), { categoryId: "cat-frete", address: nearby }, new Set()),
    ).toBe(false);
  });

  it("pedido sem categoria notifica profissional no raio", () => {
    expect(
      matchesOpenRequestAudience(profile(), { categoryId: null, address: nearby }, new Set()),
    ).toBe(true);
  });
});
