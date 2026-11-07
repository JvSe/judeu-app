import { describe, expect, it } from "vitest";

import { availabilityLabel } from "./availability";

const base = { helpers: 0, professionals: 0, nearestKm: null, etaMin: null };

describe("availabilityLabel", () => {
  it("ninguém perto", () => {
    expect(availabilityLabel({ ...base, count: 0 }).title).toBe("Ninguém disponível perto agora");
  });
  it("singular e tempo estimado", () => {
    const l = availabilityLabel({ ...base, count: 1, etaMin: 7 });
    expect(l.title).toBe("1 pessoa disponível perto de você");
    expect(l.detail).toContain("7 min");
  });
  it("plural sem tempo", () => {
    expect(availabilityLabel({ ...base, count: 4 }).title).toBe("4 pessoas disponíveis perto de você");
  });
});
