import { describe, expect, it } from "vitest";

import { DOOR_CODE_MAX_ATTEMPTS, checkDoorCode, generateDoorCode } from "./door-code";

describe("generateDoorCode", () => {
  it("4 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generateDoorCode()).toMatch(/^\d{4}$/);
  });
});

describe("checkDoorCode", () => {
  const order = { doorCode: "0427", doorCodeAttempts: 0 };

  it("pedido antigo sem código não exige nada", () => {
    expect(checkDoorCode({ doorCode: null }, undefined)).toBe("not_required");
  });
  it("código certo, inclusive com espaços", () => {
    expect(checkDoorCode(order, "0427")).toBe("ok");
    expect(checkDoorCode(order, " 04 27 ")).toBe("ok");
  });
  it("faltando ou errado", () => {
    expect(checkDoorCode(order, undefined)).toBe("missing");
    expect(checkDoorCode(order, "1234")).toBe("wrong");
    expect(checkDoorCode(order, "427")).toBe("wrong");
  });
  it("bloqueia depois do limite, mesmo com o código certo", () => {
    expect(checkDoorCode({ ...order, doorCodeAttempts: DOOR_CODE_MAX_ATTEMPTS }, "0427")).toBe("locked");
  });
});
