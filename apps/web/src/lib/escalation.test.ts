import { describe, expect, it } from "vitest";

import { escalationStartMs, escalationTarget, radiusScale } from "./escalation";
import { type OpenRequestAudienceProfile, matchesOpenRequestAudience } from "./orders";

const CONFIG = {
  escalateAnchorsAfterMin: 5,
  escalateRadiusAfterMin: 10,
  escalationRadiusMultiplier: 2,
  escalateScheduledLeadMin: 120,
};
const CREATED = "2026-11-09T12:00:00.000Z";
const at = (min: number) => new Date(new Date(CREATED).getTime() + min * 60_000);

describe("escalationTarget", () => {
  const order = { createdAt: CREATED, scheduledAt: null, escalationLevel: 0 };

  it("sobe com o tempo sem aceite", () => {
    expect(escalationTarget(order, CONFIG, at(4))).toBe(0);
    expect(escalationTarget(order, CONFIG, at(5))).toBe(1);
    expect(escalationTarget(order, CONFIG, at(10))).toBe(2);
  });

  it("nunca desce", () => {
    expect(escalationTarget({ ...order, escalationLevel: 2 }, CONFIG, at(0))).toBe(2);
  });

  it("0 desliga a etapa", () => {
    expect(escalationTarget(order, { ...CONFIG, escalateAnchorsAfterMin: 0 }, at(6))).toBe(0);
    expect(escalationTarget(order, { ...CONFIG, escalateRadiusAfterMin: 0 }, at(60))).toBe(1);
  });

  it("agendado conta a partir de 2h antes do horário", () => {
    const scheduled = { ...order, scheduledAt: "2026-11-10T12:00:00.000Z" };
    expect(escalationStartMs(scheduled, CONFIG)).toBe(new Date("2026-11-10T10:00:00.000Z").getTime());
    expect(escalationTarget(scheduled, CONFIG, at(60))).toBe(0);
    expect(escalationTarget(scheduled, CONFIG, new Date("2026-11-10T10:10:00.000Z"))).toBe(2);
  });
});

describe("radiusScale", () => {
  it("só amplia no nível 2", () => {
    expect(radiusScale(0, 2)).toBe(1);
    expect(radiusScale(1, 2)).toBe(1);
    expect(radiusScale(2, 2)).toBe(2);
    expect(radiusScale(null, 2)).toBe(1);
  });
});

describe("raio ampliado no público da ajuda aberta", () => {
  const origin = { lat: -10.1841, lng: -48.3336 };
  // ~15 km ao sul: fora de 10 km, dentro de 20 km.
  const address = { lat: -10.319, lng: -48.3336 };
  const p: OpenRequestAudienceProfile = {
    id: "p1",
    userId: "u1",
    isHelper: true,
    serviceRadiusKm: 10,
    lastLat: origin.lat,
    lastLng: origin.lng,
    lastLocationAt: new Date().toISOString(),
    baseLat: origin.lat,
    baseLng: origin.lng,
    categories: [],
  };

  it("fora do raio normal, dentro do ampliado", () => {
    const order = { categoryId: null, address };
    expect(matchesOpenRequestAudience(p, order, new Set())).toBe(false);
    expect(matchesOpenRequestAudience(p, { ...order, radiusScale: 2 }, new Set())).toBe(true);
  });
});
