import { describe, expect, it } from "vitest";

import { canTakeRisk, effectiveRisk, normalizeRisk } from "./risk";

const now = new Date("2026-11-07T12:00:00Z");
const helper = { isHelper: true, badges: [] };
const sealed = { isHelper: true, badges: [{ type: "REPAIRS_SEAL", expiresAt: null }] };
const pro = { isHelper: false, badges: [] };
const credentialed = { isHelper: false, badges: [{ type: "PRO_CREDENTIAL", expiresAt: "2027-01-01T00:00:00" }] };
const expired = { isHelper: false, badges: [{ type: "PRO_CREDENTIAL", expiresAt: "2026-01-01T00:00:00" }] };

describe("canTakeRisk", () => {
  it("nível 1: todos (comportamento atual)", () => {
    for (const p of [helper, sealed, pro, credentialed]) expect(canTakeRisk(p, 1, now)).toBe(true);
  });
  it("nível 2: profissional ou helper com selo", () => {
    expect(canTakeRisk(helper, 2, now)).toBe(false);
    expect(canTakeRisk(sealed, 2, now)).toBe(true);
    expect(canTakeRisk(pro, 2, now)).toBe(true);
  });
  it("nível 3: só profissional com credencial válida", () => {
    expect(canTakeRisk(sealed, 3, now)).toBe(false);
    expect(canTakeRisk(pro, 3, now)).toBe(false);
    expect(canTakeRisk(credentialed, 3, now)).toBe(true);
    expect(canTakeRisk(expired, 3, now)).toBe(false);
  });
  it("nível 4: ninguém", () => {
    expect(canTakeRisk(credentialed, 4, now)).toBe(false);
  });
});

describe("normalizeRisk", () => {
  it("valores fora da faixa viram 1", () => {
    expect(normalizeRisk(undefined)).toBe(1);
    expect(normalizeRisk(7)).toBe(1);
    expect(normalizeRisk(3)).toBe(3);
  });
});


describe("effectiveRisk (sugestão da IA só sobe)", () => {
  it("sem sugestão, vale a categoria", () => {
    expect(effectiveRisk(2, undefined)).toBe(2);
    expect(effectiveRisk(undefined, undefined)).toBe(1);
  });
  it("sugestão maior sobe o nível", () => {
    expect(effectiveRisk(1, 3)).toBe(3);
    expect(effectiveRisk(1, 4)).toBe(4);
  });
  it("sugestão menor não baixa", () => {
    expect(effectiveRisk(3, 1)).toBe(3);
  });
  it("valor inválido é ignorado", () => {
    expect(effectiveRisk(2, 9)).toBe(2);
  });
});
