import { describe, expect, it } from "vitest";

import {
  type ServiceZone,
  areaDenial,
  areaStatus,
  formatBrasiliaDateTime,
  brasiliaClock,
  formatClock,
  isZoneOpenAt,
  nextOpening,
  parseClock,
  parsePolygonInput,
  pointInPolygon,
} from "./zones";

// Quadrado em volta do centro de Palmas.
const SQUARE: [number, number][] = [
  [-10.1, -48.4],
  [-10.1, -48.2],
  [-10.3, -48.2],
  [-10.3, -48.4],
];
const CENTER = { lat: -10.1841, lng: -48.3336 };
const FAR = { lat: -15.78, lng: -47.93 };

function zone(over: Partial<ServiceZone> = {}): ServiceZone {
  return {
    id: "z1",
    name: "Palmas centro",
    polygon: SQUARE,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    openMinute: 8 * 60,
    closeMinute: 20 * 60,
    active: true,
    ...over,
  };
}

// 2026-11-09 é segunda-feira. 12:00 UTC = 09:00 em Brasília.
const MON_9H = new Date("2026-11-09T12:00:00Z");
const MON_22H = new Date("2026-11-10T01:00:00Z");

describe("pointInPolygon", () => {
  it("dentro e fora", () => {
    expect(pointInPolygon(CENTER, SQUARE)).toBe(true);
    expect(pointInPolygon(FAR, SQUARE)).toBe(false);
  });
});

describe("brasiliaClock", () => {
  it("UTC−3", () => {
    expect(brasiliaClock(MON_9H)).toEqual({ weekday: 1, minute: 9 * 60 });
    expect(brasiliaClock(MON_22H)).toEqual({ weekday: 1, minute: 22 * 60 });
  });
});

describe("isZoneOpenAt", () => {
  it("janela comum", () => {
    expect(isZoneOpenAt(zone(), MON_9H)).toBe(true);
    expect(isZoneOpenAt(zone(), MON_22H)).toBe(false);
  });

  it("respeita os dias", () => {
    expect(isZoneOpenAt(zone({ weekdays: [2, 3] }), MON_9H)).toBe(false);
  });

  it("janela que passa da meia-noite pertence ao dia em que abre", () => {
    const night = zone({ openMinute: 18 * 60, closeMinute: 2 * 60, weekdays: [1] });
    expect(isZoneOpenAt(night, MON_22H)).toBe(true);
    // Terça 01:00 em Brasília ainda é a noite de segunda.
    expect(isZoneOpenAt(night, new Date("2026-11-10T04:00:00Z"))).toBe(true);
    // Segunda 01:00 seria a noite de domingo, que não abre.
    expect(isZoneOpenAt(night, new Date("2026-11-09T04:00:00Z"))).toBe(false);
  });

  it("dia inteiro", () => {
    expect(isZoneOpenAt(zone({ openMinute: 0, closeMinute: 1440 }), MON_22H)).toBe(true);
  });
});

describe("nextOpening", () => {
  it("amanhã às 8h depois do fechamento", () => {
    expect(nextOpening(zone(), MON_22H)).toBe("2026-11-10T11:00:00.000Z");
  });

  it("pula dias fechados", () => {
    // Só sexta (5): de segunda 22h vai para sexta 08:00 BRT.
    expect(nextOpening(zone({ weekdays: [5] }), MON_22H)).toBe("2026-11-13T11:00:00.000Z");
  });

  it("sem dias, nunca abre", () => {
    expect(nextOpening(zone({ weekdays: [] }), MON_22H)).toBeNull();
  });
});

describe("areaStatus", () => {
  it("sem zona ativa, tudo liberado (comportamento antigo)", () => {
    expect(areaStatus(FAR, [], MON_22H)).toEqual({ status: "OPEN", zoneName: null });
    expect(areaStatus(FAR, [zone({ active: false })], MON_22H)).toEqual({ status: "OPEN", zoneName: null });
  });

  it("fora de todas as zonas", () => {
    expect(areaStatus(FAR, [zone()], MON_9H)).toEqual({ status: "OUTSIDE" });
  });

  it("dentro e no horário", () => {
    expect(areaStatus(CENTER, [zone()], MON_9H)).toEqual({ status: "OPEN", zoneName: "Palmas centro" });
  });

  it("dentro e fora do horário: informa a próxima abertura", () => {
    expect(areaStatus(CENTER, [zone()], MON_22H)).toEqual({
      status: "CLOSED",
      zoneName: "Palmas centro",
      nextOpenAt: "2026-11-10T11:00:00.000Z",
    });
  });
});

describe("parsePolygonInput", () => {
  it("uma linha 'lat, lng' por ponto", () => {
    expect(parsePolygonInput("-10.1, -48.4\n-10.1,-48.2\n-10.3 -48.2")).toEqual([
      [-10.1, -48.4],
      [-10.1, -48.2],
      [-10.3, -48.2],
    ]);
  });

  it("GeoJSON em [lng, lat], tirando o ponto repetido do fim", () => {
    const geo = JSON.stringify({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[-48.4, -10.1], [-48.2, -10.1], [-48.2, -10.3], [-48.4, -10.3], [-48.4, -10.1]]],
      },
    });
    expect(parsePolygonInput(geo)).toEqual(SQUARE);
  });

  it("recusa menos de 3 pontos ou valores inválidos", () => {
    expect(parsePolygonInput("-10.1, -48.4\n-10.1,-48.2")).toBeNull();
    expect(parsePolygonInput("a, b\nc, d\ne, f")).toBeNull();
    expect(parsePolygonInput("{quebrado")).toBeNull();
  });
});

describe("parseClock / formatClock", () => {
  it("ida e volta", () => {
    expect(parseClock("08:00")).toBe(480);
    expect(parseClock("24:00")).toBe(1440);
    expect(parseClock("8:75")).toBeNull();
    expect(formatClock(480)).toBe("08:00");
    expect(formatClock(1440)).toBe("24:00");
  });
});

describe("areaDenial", () => {
  it("aberto segue", () => {
    expect(areaDenial({ status: "OPEN", zoneName: null }, false)).toBeNull();
  });

  it("fora da zona recusa, agendado ou não", () => {
    expect(areaDenial({ status: "OUTSIDE" }, false)?.status).toBe(400);
    expect(areaDenial({ status: "OUTSIDE" }, true)?.status).toBe(400);
  });

  it("fechado: pedido agora vira 409 com a próxima abertura; agendado no horário fechado é 400", () => {
    const closed = { status: "CLOSED" as const, zoneName: "Z", nextOpenAt: "2026-11-10T11:00:00.000Z" };
    const now = areaDenial(closed, false);
    expect(now?.status).toBe(409);
    expect(now?.error).toContain("ter., 10/11 às 08:00");
    expect(areaDenial(closed, true)?.status).toBe(400);
  });

  it("formata em Brasília", () => {
    expect(formatBrasiliaDateTime("2026-11-10T01:30:00.000Z")).toBe("seg., 09/11 às 22:30");
  });
});
