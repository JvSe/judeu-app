import { describe, expect, it } from "vitest";

import type { Order } from "./api";
import { filterIncomingWork, OPEN_REQUEST_TTL_MS } from "./incoming-work";

const NOW = Date.parse("2026-11-02T12:00:00Z");
const ORIGIN = { lat: -10.1849, lng: -48.3336 }; // Palmas/TO

function order(partial: Partial<Order> & { id: string }): Order {
  return {
    status: "CREATED",
    isOpenRequest: true,
    provider: null,
    createdAt: new Date(NOW - 60_000).toISOString(),
    address: { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng },
    ...partial,
  } as unknown as Order;
}

const base = { isOn: true, acceptsDirect: true, origin: ORIGIN, radiusKm: 15, now: NOW };

describe("filterIncomingWork", () => {
  it("ajuda aberta perto e recente aparece com o modo ligado", () => {
    expect(filterIncomingWork([order({ id: "a" })], base).map((o) => o.id)).toEqual(["a"]);
  });

  it("ajuda aberta não aparece com o modo desligado", () => {
    expect(filterIncomingWork([order({ id: "a" })], { ...base, isOn: false })).toEqual([]);
  });

  it("ajuda aberta fora do raio ou velha demais fica de fora", () => {
    const far = order({ id: "far", address: { lat: ORIGIN.lat + 1, lng: ORIGIN.lng } as Order["address"] });
    const old = order({ id: "old", createdAt: new Date(NOW - OPEN_REQUEST_TTL_MS - 1).toISOString() });
    expect(filterIncomingWork([far, old], base)).toEqual([]);
  });

  it("ajuda aberta já pega por alguém não aparece", () => {
    const taken = order({ id: "t", provider: { id: "p" } as Order["provider"] });
    expect(filterIncomingWork([taken], base)).toEqual([]);
  });

  it("chamada direta aparece mesmo com o modo desligado, sem filtro de raio", () => {
    const direct = order({
      id: "d",
      isOpenRequest: false,
      provider: { id: "me" } as Order["provider"],
      address: { lat: ORIGIN.lat + 2, lng: ORIGIN.lng } as Order["address"],
    });
    expect(filterIncomingWork([direct], { ...base, isOn: false }).map((o) => o.id)).toEqual(["d"]);
    expect(filterIncomingWork([direct], { ...base, acceptsDirect: false })).toEqual([]);
  });

  it("só CREATED entra", () => {
    expect(filterIncomingWork([order({ id: "x", status: "ACCEPTED" })], base)).toEqual([]);
  });
});
