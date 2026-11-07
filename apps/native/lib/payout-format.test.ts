import { describe, expect, it } from "vitest";

import { centsToInput, reaisToCents } from "./payout-format";

describe("reaisToCents", () => {
  it("aceita formatos brasileiros", () => {
    expect(reaisToCents("50")).toBe(5000);
    expect(reaisToCents("50,5")).toBe(5050);
    expect(reaisToCents("1.234,56")).toBe(123456);
  });
  it("vazio, negativo ou texto → 0", () => {
    expect(reaisToCents("")).toBe(0);
    expect(reaisToCents("-3")).toBe(0);
    expect(reaisToCents("abc")).toBe(0);
  });
});

describe("centsToInput", () => {
  it("formata com vírgula", () => {
    expect(centsToInput(123450)).toBe("1234,50");
  });
});
