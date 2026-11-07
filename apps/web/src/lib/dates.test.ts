import { describe, expect, it } from "vitest";

import { ensureUtcIso, withUtcTimestamps } from "./dates";

describe("ensureUtcIso", () => {
  it("acrescenta Z a timestamp sem fuso, com ou sem milissegundos", () => {
    expect(ensureUtcIso("2026-11-03T15:54:17.996")).toBe("2026-11-03T15:54:17.996Z");
    expect(ensureUtcIso("2026-11-03T15:54:17")).toBe("2026-11-03T15:54:17Z");
    expect(ensureUtcIso("2026-11-03T15:54:17.123456")).toBe("2026-11-03T15:54:17.123456Z");
  });

  it("não mexe em quem já tem fuso", () => {
    expect(ensureUtcIso("2026-11-03T15:54:17.996Z")).toBe("2026-11-03T15:54:17.996Z");
    expect(ensureUtcIso("2026-11-03T15:54:17+00:00")).toBe("2026-11-03T15:54:17+00:00");
  });

  it("não mexe em outros textos", () => {
    expect(ensureUtcIso("Quadra 104 Norte")).toBe("Quadra 104 Norte");
    expect(ensureUtcIso("2026-11-03")).toBe("2026-11-03");
    expect(ensureUtcIso("08:00")).toBe("08:00");
    expect(ensureUtcIso("Chegou em 2026-11-03T15:54:17")).toBe("Chegou em 2026-11-03T15:54:17");
  });

  it("com o Z, a leitura não depende do fuso do aparelho", () => {
    expect(new Date(ensureUtcIso("2026-11-03T15:54:17")).toISOString()).toBe("2026-11-03T15:54:17.000Z");
  });
});

describe("withUtcTimestamps", () => {
  it("percorre objetos e arrays aninhados", () => {
    const input = {
      createdAt: "2026-11-03T15:54:17.996",
      n: 3,
      ok: true,
      none: null,
      events: [{ createdAt: "2026-11-03T16:00:00" }],
      client: { name: "Maria", createdAt: "2026-01-01T00:00:00" },
    };
    expect(withUtcTimestamps(input)).toEqual({
      createdAt: "2026-11-03T15:54:17.996Z",
      n: 3,
      ok: true,
      none: null,
      events: [{ createdAt: "2026-11-03T16:00:00Z" }],
      client: { name: "Maria", createdAt: "2026-01-01T00:00:00Z" },
    });
    expect(input.createdAt).toBe("2026-11-03T15:54:17.996");
  });
});
