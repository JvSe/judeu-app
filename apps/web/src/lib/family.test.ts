import { describe, expect, it } from "vitest";

import { familyEmail, isShareLinkActive, newShareToken } from "./family";

describe("newShareToken", () => {
  it("32 hex, imprevisível", () => {
    expect(newShareToken()).toMatch(/^[0-9a-f]{32}$/);
    expect(newShareToken()).not.toBe(newShareToken());
  });
});

describe("familyEmail", () => {
  const ctx = { clientFirstName: "Maria", providerFirstName: "João", task: "Trocar lâmpada", link: "https://x/t/abc" };
  it("chegada menciona o código confirmado e leva o link", () => {
    const m = familyEmail("start_work", ctx);
    expect(m.subject).toBe("João chegou na casa de Maria");
    expect(m.body).toContain("código de chegada");
    expect(m.body).toContain("https://x/t/abc");
  });
  it("aceite cita a tarefa", () => {
    expect(familyEmail("accept", ctx).body).toContain('"Trocar lâmpada"');
  });
});

describe("isShareLinkActive", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("pedido aberto: ativo", () => {
    expect(isShareLinkActive({ status: "EN_ROUTE", completedAt: null, cancelledAt: null }, now)).toBe(true);
  });
  it("até 24 h depois de encerrado", () => {
    expect(
      isShareLinkActive({ status: "COMPLETED", completedAt: "2026-11-06T13:00:00", cancelledAt: null }, now),
    ).toBe(true);
    expect(
      isShareLinkActive({ status: "COMPLETED", completedAt: "2026-11-06T11:00:00", cancelledAt: null }, now),
    ).toBe(false);
  });
});
