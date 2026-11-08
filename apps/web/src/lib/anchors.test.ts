import { describe, expect, it } from "vitest";

import { isShiftActive, isShiftDue, shiftFloorCents, shiftSettlement, shouldCountPresence } from "./anchors";
import { brasiliaToUtc } from "./zones";

const SHIFT = { startsAt: "2026-11-09T11:00:00.000Z", endsAt: "2026-11-09T17:00:00.000Z", status: "SCHEDULED" };

describe("janela do turno", () => {
  it("ativo só entre início e fim, e só agendado", () => {
    expect(isShiftActive(SHIFT, new Date("2026-11-09T10:59:00Z"))).toBe(false);
    expect(isShiftActive(SHIFT, new Date("2026-11-09T12:00:00Z"))).toBe(true);
    expect(isShiftActive(SHIFT, new Date("2026-11-09T17:00:00Z"))).toBe(false);
    expect(isShiftActive({ ...SHIFT, status: "CANCELLED" }, new Date("2026-11-09T12:00:00Z"))).toBe(false);
  });

  it("fecha a conta depois da folga", () => {
    expect(isShiftDue(SHIFT, new Date("2026-11-09T19:59:00Z"), 180)).toBe(false);
    expect(isShiftDue(SHIFT, new Date("2026-11-09T20:00:00Z"), 180)).toBe(true);
    expect(isShiftDue({ ...SHIFT, status: "SETTLED" }, new Date("2026-11-10T00:00:00Z"), 180)).toBe(false);
  });
});

describe("presença", () => {
  it("não conta duas vezes no mesmo minuto", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(shouldCountPresence(null, now)).toBe(true);
    expect(shouldCountPresence("2026-11-09T11:59:30Z", now)).toBe(false);
    expect(shouldCountPresence("2026-11-09T11:59:00Z", now)).toBe(true);
  });
});

describe("conta do turno", () => {
  it("piso proporcional ao tempo disponível", () => {
    expect(shiftFloorCents(1500, 60)).toBe(1500);
    expect(shiftFloorCents(1500, 90)).toBe(2250);
    expect(shiftFloorCents(1500, 0)).toBe(0);
  });

  it("complemento = piso − ganho líquido (taxa de 20% descontada)", () => {
    // 4h disponível a R$ 15/h = R$ 60. Um pedido de R$ 40 com 20% → R$ 32 líquidos.
    const r = shiftSettlement({ hourlyFloorCents: 1500, onlineMinutes: 240 }, [
      { priceCents: 4000, feeRate: 0.2, feePayer: "PROVIDER" },
    ]);
    expect(r).toEqual({ floorCents: 6000, earnedCents: 3200, subsidyCents: 2800 });
  });

  it("sem complemento quando o ganho passa do piso", () => {
    const r = shiftSettlement({ hourlyFloorCents: 1500, onlineMinutes: 60 }, [
      { priceCents: 4000, feeRate: 0.2, feePayer: "PROVIDER" },
    ]);
    expect(r.subsidyCents).toBe(0);
  });

  it("pedido antigo (8% do cliente): quem atende recebe o preço cheio", () => {
    const r = shiftSettlement({ hourlyFloorCents: 1500, onlineMinutes: 60 }, [{ priceCents: 1000 }]);
    expect(r.earnedCents).toBe(1000);
  });
});

describe("brasiliaToUtc", () => {
  it("08:00 em Brasília = 11:00 UTC; 24h+ cai no dia seguinte", () => {
    expect(brasiliaToUtc("2026-11-09", 8 * 60)).toBe("2026-11-09T11:00:00.000Z");
    expect(brasiliaToUtc("2026-11-09", 26 * 60)).toBe("2026-11-10T05:00:00.000Z");
    expect(brasiliaToUtc("09/11/2026", 0)).toBeNull();
  });
});
