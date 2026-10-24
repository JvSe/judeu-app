import { describe, expect, it } from "vitest";

import { effectiveProviderPosition, etaMinFromKm } from "./catalog";

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
