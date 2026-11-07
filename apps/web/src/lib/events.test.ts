import { describe, expect, it } from "vitest";

import { buildAppEvent } from "./events";

describe("buildAppEvent", () => {
  it("preenche os opcionais com null/{} e usa o instante dado", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const row = buildAppEvent({ type: "search.no_results" }, now);
    expect(row).toMatchObject({
      type: "search.no_results",
      userId: null,
      orderId: null,
      props: {},
      createdAt: "2026-11-06T12:00:00.000Z",
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("mantém userId, orderId e props", () => {
    const row = buildAppEvent({
      type: "order.eta_measured",
      userId: "u1",
      orderId: "o1",
      props: { predictedMin: 12, actualMin: 15 },
    });
    expect(row).toMatchObject({
      userId: "u1",
      orderId: "o1",
      props: { predictedMin: 12, actualMin: 15 },
    });
  });

  it("gera ids diferentes", () => {
    expect(buildAppEvent({ type: "search.performed" }).id).not.toBe(
      buildAppEvent({ type: "search.performed" }).id,
    );
  });
});
