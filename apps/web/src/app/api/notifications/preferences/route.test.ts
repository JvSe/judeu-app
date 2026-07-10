import { describe, expect, it } from "vitest";

import { notificationPreferencesSchema } from "./route";

describe("notificationPreferencesSchema", () => {
  it("aceita ligar/desligar só notifyOrders", () => {
    expect(notificationPreferencesSchema.safeParse({ notifyOrders: false }).success).toBe(true);
  });

  it("aceita ligar/desligar só notifyMessages", () => {
    expect(notificationPreferencesSchema.safeParse({ notifyMessages: true }).success).toBe(true);
  });

  it("aceita os dois campos juntos", () => {
    const result = notificationPreferencesSchema.safeParse({
      notifyOrders: true,
      notifyMessages: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita payload vazio — precisa informar ao menos uma preferência", () => {
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita valores não-booleanos", () => {
    expect(notificationPreferencesSchema.safeParse({ notifyOrders: "sim" }).success).toBe(false);
  });
});
