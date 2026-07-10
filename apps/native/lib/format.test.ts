import { describe, expect, it, vi } from "vitest";

import {
  dateGroupLabel,
  initialsOf,
  isOrderActive,
  moneyFromCents,
  orderStatusLabel,
  priceFromCents,
  relativeTime,
  shortDateTime,
  shortTime,
} from "./format";

describe("initialsOf", () => {
  it("pega a primeira letra do primeiro e do último nome", () => {
    expect(initialsOf("Carlos Mendes")).toBe("CM");
  });

  it("nome único usa só a primeira letra", () => {
    expect(initialsOf("Carlos")).toBe("C");
  });

  it("ignora espaços extras", () => {
    expect(initialsOf("  Ana   Paula  ")).toBe("AP");
  });
});

describe("priceFromCents", () => {
  it("formata sem casas decimais, arredondando", () => {
    expect(priceFromCents(8000)).toBe("R$ 80");
    expect(priceFromCents(8050)).toBe("R$ 81"); // Math.round
  });

  it("retorna travessão pra null", () => {
    expect(priceFromCents(null)).toBe("—");
  });
});

describe("moneyFromCents", () => {
  it("formata com centavos e vírgula", () => {
    expect(moneyFromCents(8490)).toBe("R$ 84,90");
    expect(moneyFromCents(6000)).toBe("R$ 60,00");
  });
});

describe("orderStatusLabel / isOrderActive", () => {
  it("traduz todos os status do pedido", () => {
    expect(orderStatusLabel("CREATED")).toBe("Aguardando");
    expect(orderStatusLabel("COMPLETED")).toBe("Concluído");
    expect(orderStatusLabel("CANCELLED")).toBe("Cancelado");
  });

  it("só COMPLETED e CANCELLED não são ativos", () => {
    expect(isOrderActive("CREATED")).toBe(true);
    expect(isOrderActive("EN_ROUTE")).toBe(true);
    expect(isOrderActive("COMPLETED")).toBe(false);
    expect(isOrderActive("CANCELLED")).toBe(false);
  });
});

describe("shortTime / shortDateTime", () => {
  it("shortTime formata HH:MM com zero à esquerda", () => {
    expect(shortTime("2026-07-10T09:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("shortDateTime usa 'Hoje' pra data de hoje", () => {
    const now = new Date().toISOString();
    expect(shortDateTime(now)).toMatch(/^Hoje, \d{2}:\d{2}$/);
  });

  it("shortDateTime usa DD/MM pra datas passadas", () => {
    expect(shortDateTime("2020-01-15T12:00:00.000Z")).toMatch(/^\d{2}\/\d{2}, \d{2}:\d{2}$/);
  });
});

describe("relativeTime", () => {
  it("menos de 1 min vira 'agora'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(relativeTime("2026-07-10T11:59:40.000Z")).toBe("agora");
    vi.useRealTimers();
  });

  it("minutos vira 'há N min'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(relativeTime("2026-07-10T11:55:00.000Z")).toBe("há 5 min");
    vi.useRealTimers();
  });

  it("horas vira 'há Nh'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(relativeTime("2026-07-10T09:00:00.000Z")).toBe("há 3h");
    vi.useRealTimers();
  });

  it("mais de 24h cai pro shortDateTime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(relativeTime("2026-07-08T12:00:00.000Z")).toMatch(/^\d{2}\/\d{2}, \d{2}:\d{2}$/);
    vi.useRealTimers();
  });
});

describe("dateGroupLabel", () => {
  // Mesmo horário UTC em "agora" e nas datas de referência — evita que o teste
  // dependa do fuso horário da máquina (dateGroupLabel compara o dia local).
  it("hoje vira HOJE", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(dateGroupLabel("2026-07-10T12:00:00.000Z")).toBe("HOJE");
    vi.useRealTimers();
  });

  it("ontem vira ONTEM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(dateGroupLabel("2026-07-09T12:00:00.000Z")).toBe("ONTEM");
    vi.useRealTimers();
  });

  it("mais antigo vira DD/MM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    expect(dateGroupLabel("2026-07-01T12:00:00.000Z")).toBe("01/07");
    vi.useRealTimers();
  });
});
