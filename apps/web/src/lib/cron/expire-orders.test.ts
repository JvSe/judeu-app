import { describe, expect, it } from "vitest";

import { expiryDecision } from "./expire-orders";

const config = { openRequestTtlMs: 4 * 60 * 60_000, directOfferAbandonMs: 30 * 60_000 };
const now = new Date("2026-11-06T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString().replace("Z", "");

describe("expiryDecision", () => {
  it("ajuda aberta com menos de 4 h fica no ar", () => {
    expect(
      expiryDecision({ id: "o", isOpenRequest: true, providerId: null, createdAt: minutesAgo(239), scheduledAt: null }, config, now),
    ).toBeNull();
  });

  it("ajuda aberta com mais de 4 h expira", () => {
    expect(
      expiryDecision({ id: "o", isOpenRequest: true, providerId: null, createdAt: minutesAgo(241), scheduledAt: null }, config, now),
    ).toBe("OPEN_REQUEST_EXPIRED");
  });

  it("chamada direta: 60 s não bastam, só depois de 30 min", () => {
    const base = { id: "o", isOpenRequest: false, providerId: "p1", scheduledAt: null };
    expect(expiryDecision({ ...base, createdAt: minutesAgo(5) }, config, now)).toBeNull();
    expect(expiryDecision({ ...base, createdAt: minutesAgo(31) }, config, now)).toBe("DIRECT_OFFER_ABANDONED");
  });

  it("pedido agendado conta a partir do horário marcado", () => {
    const scheduledAt = new Date(now.getTime() + 60 * 60_000).toISOString();
    expect(
      expiryDecision(
        { id: "o", isOpenRequest: false, providerId: "p1", createdAt: minutesAgo(600), scheduledAt },
        config,
        now,
      ),
    ).toBeNull();
  });

  it("lê horário do banco sem 'Z' como UTC", () => {
    expect(
      expiryDecision({ id: "o", isOpenRequest: true, providerId: null, createdAt: "2026-11-06T07:59:00", scheduledAt: null }, config, now),
    ).toBe("OPEN_REQUEST_EXPIRED");
  });
});
