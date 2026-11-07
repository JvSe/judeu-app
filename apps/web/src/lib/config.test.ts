import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, mergeConfig, toPublicConfig } from "./config";
import { OFFER_TTL_MS, OPEN_REQUEST_TTL_MS } from "./orders";

describe("DEFAULT_CONFIG", () => {
  it("pedidos novos: 20% descontados de quem atende", () => {
    expect(DEFAULT_CONFIG.platformFeeRate).toBe(0.2);
    expect(DEFAULT_CONFIG.feePayer).toBe("PROVIDER");
  });

  it("TTLs iguais aos atuais", () => {
    expect(DEFAULT_CONFIG.openRequestTtlMs).toBe(OPEN_REQUEST_TTL_MS);
    expect(DEFAULT_CONFIG.offerTtlMs).toBe(OFFER_TTL_MS);
  });
});

describe("mergeConfig", () => {
  it("sem linhas, devolve os padrões", () => {
    expect(mergeConfig([])).toEqual(DEFAULT_CONFIG);
  });

  it("sobrescreve só a chave presente", () => {
    const cfg = mergeConfig([{ key: "platformFeeRate", value: 0.15 }]);
    expect(cfg.platformFeeRate).toBe(0.15);
    expect(cfg.feePayer).toBe("PROVIDER");
  });

  it("ignora chave desconhecida", () => {
    expect(mergeConfig([{ key: "naoExiste", value: 1 }])).toEqual(DEFAULT_CONFIG);
  });

  it("valor inválido cai no padrão daquela chave", () => {
    const cfg = mergeConfig([
      { key: "platformFeeRate", value: 3 },
      { key: "feePayer", value: "NINGUEM" },
      { key: "offerTtlMs", value: 30_000 },
    ]);
    expect(cfg.platformFeeRate).toBe(DEFAULT_CONFIG.platformFeeRate);
    expect(cfg.feePayer).toBe(DEFAULT_CONFIG.feePayer);
    expect(cfg.offerTtlMs).toBe(30_000);
  });

  it("não altera DEFAULT_CONFIG", () => {
    mergeConfig([{ key: "platformFeeRate", value: 0.5 }]);
    expect(DEFAULT_CONFIG.platformFeeRate).toBe(0.2);
  });
});

describe("toPublicConfig", () => {
  it("expõe só as chaves públicas", () => {
    expect(Object.keys(toPublicConfig(DEFAULT_CONFIG)).sort()).toEqual(
      ["feePayer", "offerTtlMs", "openRequestTtlMs", "platformFeeRate"].sort(),
    );
  });
});
