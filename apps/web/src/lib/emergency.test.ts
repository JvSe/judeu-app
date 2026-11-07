import { describe, expect, it } from "vitest";

import { emergencyMessage } from "./emergency";

describe("emergencyMessage", () => {
  it("inclui quem acionou, o pedido e o link do mapa", () => {
    const m = emergencyMessage({ byRole: "client", orderId: "o1", status: "IN_PROGRESS", lat: -10.18, lng: -48.33 });
    expect(m).toContain("o cliente");
    expect(m).toContain("o1");
    expect(m).toContain("mlat=-10.18");
  });
  it("sem localização", () => {
    expect(
      emergencyMessage({ byRole: "provider", orderId: "o1", status: "EN_ROUTE", lat: null, lng: null }),
    ).toContain("Localização não disponível");
  });
});
