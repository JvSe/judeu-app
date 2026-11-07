import { describe, expect, it } from "vitest";

import { shouldAutoBlock, slaDueAt } from "./moderation";

const cfg = { autoBlockMinReviews: 5, autoBlockMaxAvg: 3, supportUrgentSlaMin: 60, supportSlaMin: 1440 };

describe("shouldAutoBlock", () => {
  it("precisa de avaliações suficientes", () => {
    expect(shouldAutoBlock([1, 1, 1, 1], cfg)).toBe(false);
  });
  it("média abaixo de 3 com 5+ avaliações", () => {
    expect(shouldAutoBlock([1, 2, 3, 2, 4], cfg)).toBe(true);
    expect(shouldAutoBlock([3, 3, 3, 3, 3], cfg)).toBe(false);
  });
});

describe("slaDueAt", () => {
  const t = new Date("2026-11-07T12:00:00Z");
  it("segurança e disputa: 1 h", () => {
    expect(slaDueAt("SECURITY", t, cfg)).toBe("2026-11-07T13:00:00.000Z");
    expect(slaDueAt("DISPUTE", t, cfg)).toBe("2026-11-07T13:00:00.000Z");
  });
  it("demais: 24 h", () => {
    expect(slaDueAt("PAYMENT", t, cfg)).toBe("2026-11-08T12:00:00.000Z");
  });
});
