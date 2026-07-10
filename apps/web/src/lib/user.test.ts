import { describe, expect, it } from "vitest";

import { publicUser, roleSchema } from "./user";

describe("roleSchema", () => {
  it("aceita os três papéis válidos", () => {
    expect(roleSchema.safeParse("CLIENT").success).toBe(true);
    expect(roleSchema.safeParse("PROVIDER").success).toBe(true);
    expect(roleSchema.safeParse("BOTH").success).toBe(true);
  });

  it("rejeita papel inválido", () => {
    expect(roleSchema.safeParse("ADMIN").success).toBe(false);
    expect(roleSchema.safeParse("").success).toBe(false);
  });
});

describe("publicUser", () => {
  it("nunca inclui passwordHash mesmo se o objeto de entrada tiver o campo", () => {
    const row = {
      id: "u1",
      email: "a@b.com",
      fullName: "Fulano",
      phone: null,
      role: "CLIENT",
      avatarUrl: null,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "segredo-nunca-deveria-sair-daqui",
    };

    const result = publicUser(row);

    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toEqual({
      id: "u1",
      email: "a@b.com",
      fullName: "Fulano",
      phone: null,
      role: "CLIENT",
      avatarUrl: null,
      emailVerified: false,
      phoneVerified: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
