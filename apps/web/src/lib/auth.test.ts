import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { RESET_MAX_ATTEMPTS, checkResetCode, generateResetCode } from "./auth";

const userId = "u1";
const hash = (code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");
const future = new Date(Date.now() + 10 * 60_000).toISOString();
const record = (over: Partial<Parameters<typeof checkResetCode>[0]> = {}) => ({
  userId,
  tokenHash: hash("482913"),
  expiresAt: future,
  usedAt: null,
  attempts: 0,
  ...over,
});

describe("generateResetCode", () => {
  it("gera 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generateResetCode()).toMatch(/^\d{6}$/);
  });

  it("não é fixo (QA C-01)", () => {
    const codes = new Set(Array.from({ length: 20 }, generateResetCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("checkResetCode", () => {
  it("aceita o código certo", () => {
    expect(checkResetCode(record(), "482913")).toBe("ok");
  });

  it("recusa o código errado, inclusive o antigo 123456", () => {
    expect(checkResetCode(record(), "123456")).toBe("mismatch");
  });

  it("bloqueia depois do limite de tentativas, mesmo com o código certo", () => {
    expect(checkResetCode(record({ attempts: RESET_MAX_ATTEMPTS }), "482913")).toBe("locked");
  });

  it("recusa código expirado ou já usado", () => {
    expect(checkResetCode(record({ expiresAt: "2020-01-01T00:00:00Z" }), "482913")).toBe("expired");
    expect(checkResetCode(record({ usedAt: "2026-11-06T00:00:00Z" }), "482913")).toBe("expired");
  });
});
