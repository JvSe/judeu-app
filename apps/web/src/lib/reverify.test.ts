import { describe, expect, it } from "vitest";

import { reverifyDecision } from "./reverify";

const cfg = { reverifyProbability: 0.1, reverifyFreshMin: 30 };
const now = new Date("2026-11-07T12:00:00Z");

describe("reverifyDecision", () => {
  it("pendente bloqueia sempre", () => {
    expect(reverifyDecision({ reverifyRequiredAt: "2026-11-07T11:00:00" }, cfg, 0.9, now)).toBe("pending");
  });
  it("selfie recente dispensa", () => {
    expect(reverifyDecision({ lastSelfieAt: "2026-11-07T11:45:00" }, cfg, 0.0, now)).toBe("fresh");
  });
  it("sorteio abaixo da chance pede selfie; acima, segue", () => {
    expect(reverifyDecision({}, cfg, 0.05, now)).toBe("required");
    expect(reverifyDecision({}, cfg, 0.5, now)).toBe("skip");
  });
  it("chance 0 desliga", () => {
    expect(reverifyDecision({}, { ...cfg, reverifyProbability: 0 }, 0, now)).toBe("skip");
  });
});
