import { describe, expect, it } from "vitest";

import { EXPIRY_NOTES } from "./cron/expire-orders";
import { type MetricsOrder, acceptanceStats, funnel, repurchase30d } from "./metrics";

const now = new Date("2026-11-06T12:00:00Z");
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString().replace("Z", "");
const dayAgo = (d: number) => minAgo(d * 24 * 60);

const order = (over: Partial<MetricsOrder>): MetricsOrder => ({
  id: Math.random().toString(),
  clientId: "c1",
  isOpenRequest: true,
  status: "CREATED",
  createdAt: minAgo(60),
  acceptedAt: null,
  completedAt: null,
  cancelReason: null,
  platformFeeCents: 0,
  totalCents: 0,
  neighborhood: "Centro",
  categoryName: null,
  ...over,
});

describe("acceptanceStats", () => {
  it("conta aceite em < 10 min por bairro e ignora pedido recente ainda no ar", () => {
    const s = acceptanceStats(
      [
        order({ createdAt: minAgo(60), acceptedAt: minAgo(55) }), // 5 min ✓
        order({ createdAt: minAgo(60), acceptedAt: minAgo(40) }), // 20 min ✗
        order({ createdAt: minAgo(60), neighborhood: "Norte" }), // nunca aceito ✗
        order({ createdAt: minAgo(3) }), // recente: fora do denominador
        order({ isOpenRequest: false, acceptedAt: minAgo(59) }), // chamada direta: fora
      ],
      now,
    );
    expect(s).toMatchObject({ eligible: 3, accepted: 2, under10: 1 });
    expect(s.rateUnder10).toBeCloseTo(1 / 3);
    expect(s.medianMinutesToAccept).toBe(12.5);
    expect(s.byNeighborhood).toEqual([
      { key: "Centro", total: 2, under10: 1, rate: 0.5 },
      { key: "Norte", total: 1, under10: 0, rate: 0 },
    ]);
  });

  it("sem dados", () => {
    expect(acceptanceStats([], now)).toMatchObject({ eligible: 0, rateUnder10: null, medianMinutesToAccept: null });
  });
});

describe("funnel", () => {
  it("separa expirados dos cancelados e soma receita dos concluídos", () => {
    const f = funnel([
      order({ status: "COMPLETED", acceptedAt: minAgo(50), platformFeeCents: 800, totalCents: 4000 }),
      order({ status: "CANCELLED", cancelReason: EXPIRY_NOTES.OPEN_REQUEST_EXPIRED }),
      order({ status: "CANCELLED", cancelReason: "Cancelado pelo cliente" }),
      order({}),
    ]);
    expect(f).toEqual({
      created: 4,
      accepted: 1,
      completed: 1,
      cancelled: 2,
      expired: 1,
      platformRevenueCents: 800,
      gmvCents: 4000,
    });
  });
});

describe("repurchase30d", () => {
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60_000);

  it("conta quem voltou em até 30 dias depois da primeira conclusão", () => {
    const r = repurchase30d(
      [
        // c1: concluiu há 60 dias e pediu de novo 10 dias depois ✓
        { clientId: "c1", status: "COMPLETED", createdAt: dayAgo(61), completedAt: dayAgo(60) },
        { clientId: "c1", status: "CREATED", createdAt: dayAgo(50), completedAt: null },
        // c2: concluiu há 45 dias e não voltou ✗
        { clientId: "c2", status: "COMPLETED", createdAt: dayAgo(46), completedAt: dayAgo(45) },
        // c3: concluiu há 10 dias — ainda sem janela de 30 dias, fora do grupo
        { clientId: "c3", status: "COMPLETED", createdAt: dayAgo(11), completedAt: dayAgo(10) },
      ],
      from,
      now,
    );
    expect(r).toEqual({ cohort: 2, repurchased: 1, rate: 0.5 });
  });
});
