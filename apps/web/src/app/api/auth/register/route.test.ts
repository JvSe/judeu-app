import { describe, expect, it } from "vitest";

import { registerSchema } from "./route";

const validPayload = {
  fullName: "Fulano de Tal",
  email: "fulano@example.com",
  password: "senha12345",
  acceptedTerms: true as const,
};

describe("registerSchema", () => {
  it("aceita o payload mínimo válido", () => {
    expect(registerSchema.safeParse(validPayload).success).toBe(true);
  });

  it("exige acceptedTerms === true (RNF-4, LGPD) — false não passa", () => {
    const result = registerSchema.safeParse({ ...validPayload, acceptedTerms: false });
    expect(result.success).toBe(false);
  });

  it("exige acceptedTerms — ausente não passa", () => {
    const { acceptedTerms: _omit, ...rest } = validPayload;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it("rejeita senha curta", () => {
    expect(registerSchema.safeParse({ ...validPayload, password: "curta" }).success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    expect(registerSchema.safeParse({ ...validPayload, email: "não-é-email" }).success).toBe(
      false,
    );
  });

  it("rejeita nome com 1 caractere", () => {
    expect(registerSchema.safeParse({ ...validPayload, fullName: "A" }).success).toBe(false);
  });

  it("aceita role e phone opcionais quando presentes", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      phone: "63999990000",
      role: "PROVIDER",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita role fora do enum", () => {
    expect(registerSchema.safeParse({ ...validPayload, role: "ADMIN" }).success).toBe(false);
  });
});
