import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "./config";
import { isOffHours, median, roundToFiveReais, suggestPrice } from "./pricing";

const noon = new Date("2026-11-06T15:00:00Z"); // 12h em Brasília
const night = new Date("2026-11-07T01:00:00Z"); // 22h em Brasília
const none = { categoryOrders: [], categoryCatalog: [], globalOrders: [] };

describe("median / roundToFiveReais", () => {
  it("mediana par e ímpar", () => {
    expect(median([3000, 1000, 2000])).toBe(2000);
    expect(median([1000, 2000, 3000, 4000])).toBe(2500);
    expect(median([])).toBeNull();
  });
  it("arredonda para múltiplos de R$ 5, mínimo R$ 5", () => {
    expect(roundToFiveReais(4120)).toBe(4000);
    expect(roundToFiveReais(4300)).toBe(4500);
    expect(roundToFiveReais(100)).toBe(500);
  });
});

describe("isOffHours (Brasília)", () => {
  it("12h é horário comercial, 22h não", () => {
    expect(isOffHours(noon, DEFAULT_CONFIG)).toBe(false);
    expect(isOffHours(night, DEFAULT_CONFIG)).toBe(true);
  });
});

describe("suggestPrice", () => {
  it("sem dados: R$ 40 de dia", () => {
    expect(suggestPrice(none, DEFAULT_CONFIG, noon)).toEqual({
      priceCents: 4000,
      source: "default",
      offHours: false,
    });
  });

  it("fora do horário: +20%", () => {
    expect(suggestPrice(none, DEFAULT_CONFIG, night).priceCents).toBe(5000);
  });

  it("histórico da categoria vence quando tem amostras suficientes", () => {
    const r = suggestPrice(
      { ...none, categoryOrders: [3000, 3000, 3500, 3500, 3500], categoryCatalog: [9000] },
      DEFAULT_CONFIG,
      noon,
    );
    expect(r).toMatchObject({ priceCents: 3500, source: "category_history" });
  });

  it("poucas amostras: cai para o catálogo da categoria", () => {
    const r = suggestPrice({ ...none, categoryOrders: [3000], categoryCatalog: [6000, 8000] }, DEFAULT_CONFIG, noon);
    expect(r).toMatchObject({ priceCents: 7000, source: "category_catalog" });
  });
});
