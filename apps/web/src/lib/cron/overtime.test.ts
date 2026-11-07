import { describe, expect, it } from "vitest";

import { completionGeofence } from "../orders";
import { isOvertime } from "./overtime";
import { isRetentionWindow } from "./retention";

const now = new Date("2026-11-07T12:00:00Z");

describe("isOvertime", () => {
  it("passa de previsto × 1,5", () => {
    expect(isOvertime("2026-11-07T10:00:00", 60, 1.5, now)).toBe(true); // 120 > 90
    expect(isOvertime("2026-11-07T11:00:00", 60, 1.5, now)).toBe(false); // 60 < 90
    expect(isOvertime(null, 60, 1.5, now)).toBe(false);
  });
});

describe("completionGeofence", () => {
  const base = {
    status: "IN_PROGRESS" as const,
    address: { lat: -10.18, lng: -48.33 },
    pickupAddress: null,
  };
  const fresh = new Date(now.getTime() - 60_000).toISOString();
  const stale = new Date(now.getTime() - 60 * 60_000).toISOString();

  it("no local com posição recente: ok", () => {
    expect(
      completionGeofence({ ...base, providerLat: -10.1801, providerLng: -48.3301, providerLocationAt: fresh }, 300_000, now.getTime()),
    ).toBe("ok");
  });
  it("longe com posição recente: bloqueia", () => {
    expect(
      completionGeofence({ ...base, providerLat: -10.25, providerLng: -48.33, providerLocationAt: fresh }, 300_000, now.getTime()),
    ).toBe("away");
  });
  it("sem posição recente: não bloqueia (fica registrado)", () => {
    expect(
      completionGeofence({ ...base, providerLat: -10.25, providerLng: -48.33, providerLocationAt: stale }, 300_000, now.getTime()),
    ).toBe("unknown");
    expect(completionGeofence({ ...base, providerLat: null, providerLng: null, providerLocationAt: null }, 300_000)).toBe(
      "unknown",
    );
  });
});


describe("isRetentionWindow", () => {
  it("só às 03:00 UTC", () => {
    expect(isRetentionWindow(new Date("2026-11-07T03:00:30Z"))).toBe(true);
    expect(isRetentionWindow(new Date("2026-11-07T03:01:00Z"))).toBe(false);
    expect(isRetentionWindow(new Date("2026-11-07T15:00:00Z"))).toBe(false);
  });
});
