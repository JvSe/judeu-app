import { describe, expect, it } from "vitest";

import { cashDebtError, professionalUpsertOverrides } from "./provider-profile";

const pro = { isHelper: false, status: "APPROVED" as const, baseLat: -10.1, baseLng: -48.3 };
const helper = { isHelper: true, status: "APPROVED" as const, baseLat: -10.2, baseLng: -48.4 };

describe("professionalUpsertOverrides", () => {
  it("helper aprovado que vira profissional volta para PENDING (QA H-01)", () => {
    expect(professionalUpsertOverrides(helper, {}).status).toBe("PENDING");
  });

  it("helper bloqueado continua bloqueado (não mexe no status)", () => {
    expect(professionalUpsertOverrides({ ...helper, status: "BLOCKED" }, {}).status).toBeUndefined();
  });

  it("profissional que edita o cadastro mantém o status", () => {
    expect(professionalUpsertOverrides(pro, {}).status).toBeUndefined();
  });

  it("cadastro novo não define status (vale o padrão PENDING do banco)", () => {
    expect(professionalUpsertOverrides(null, {}).status).toBeUndefined();
  });

  it("preserva a base quando o app não envia (QA P-14)", () => {
    expect(professionalUpsertOverrides(pro, {})).toMatchObject({ baseLat: -10.1, baseLng: -48.3 });
  });

  it("usa a base enviada pelo app", () => {
    expect(professionalUpsertOverrides(pro, { baseLat: 1, baseLng: 2 })).toMatchObject({
      baseLat: 1,
      baseLng: 2,
    });
  });

  it("cadastro novo sem base fica com null", () => {
    expect(professionalUpsertOverrides(null, {})).toEqual({ baseLat: null, baseLng: null });
  });
});

describe("cashDebtError", () => {
  it("saldo positivo ou dívida até o limite: libera", () => {
    expect(cashDebtError(1000, 5000)).toBeNull();
    expect(cashDebtError(-5000, 5000)).toBeNull();
  });

  it("dívida acima do limite: bloqueia com o valor devido", () => {
    expect(cashDebtError(-5001, 5000)).toContain("R$ 50,01");
  });
});
