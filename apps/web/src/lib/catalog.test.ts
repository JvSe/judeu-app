import { describe, expect, it } from "vitest";

import { PUBLIC_POSITION_GRID_DEG, coarsen, effectiveProviderPosition, etaMinFromKm } from "./catalog";

describe("effectiveProviderPosition", () => {
  const base = { lastLat: null, lastLng: null, lastLocationAt: null, baseLat: -10.18, baseLng: -48.33 };

  it("usa a base quando não há GPS ao vivo", () => {
    expect(effectiveProviderPosition(base)).toEqual({ lat: -10.18, lng: -48.33 });
  });

  it("prefere o GPS recente", () => {
    expect(
      effectiveProviderPosition({
        ...base,
        lastLat: -10.2,
        lastLng: -48.4,
        lastLocationAt: new Date(),
      }),
    ).toEqual({ lat: -10.2, lng: -48.4 });
  });

  it("ignora GPS velho e volta pra base", () => {
    expect(
      effectiveProviderPosition({
        ...base,
        lastLat: -10.2,
        lastLng: -48.4,
        lastLocationAt: new Date(Date.now() - 20 * 60 * 1000),
      }),
    ).toEqual({ lat: -10.18, lng: -48.33 });
  });

  it("devolve null se não há nenhuma coordenada", () => {
    expect(
      effectiveProviderPosition({
        lastLat: null,
        lastLng: null,
        lastLocationAt: null,
        baseLat: null,
        baseLng: null,
      }),
    ).toBeNull();
  });
});

describe("etaMinFromKm", () => {
  it("aproxima 30 km/h urbano, mínimo 1 min", () => {
    expect(etaMinFromKm(0)).toBe(1);
    expect(etaMinFromKm(15)).toBe(30);
  });
});

describe("coarsen (posição pública, QA A-06)", () => {
  it("null continua null", () => {
    expect(coarsen(null)).toBeNull();
  });

  it("encaixa na grade de ~550 m", () => {
    expect(coarsen(-10.18412)).toBe(-10.185);
    expect(coarsen(-48.33361)).toBe(-48.335);
  });

  it("nunca desloca mais que meia célula", () => {
    for (const v of [-10.1841, -10.1826, -48.3336, 0.0024, 12.3456789]) {
      expect(Math.abs((coarsen(v) as number) - v)).toBeLessThanOrEqual(PUBLIC_POSITION_GRID_DEG / 2 + 1e-9);
    }
  });

  it("dois pontos a poucos metros caem na mesma célula", () => {
    expect(coarsen(-10.18412)).toBe(coarsen(-10.18398));
  });
});
