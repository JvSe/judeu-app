import { describe, expect, it } from "vitest";

import { isCronAuthorized } from "./auth";
import { CRON_JOBS } from "./index";
import { runJobs } from "./runner";

const SECRET = "s".repeat(40);

describe("isCronAuthorized", () => {
  it("recusa quando não há segredo configurado", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, undefined)).toBe(false);
  });

  it("recusa sem header ou com outro esquema", () => {
    expect(isCronAuthorized(null, SECRET)).toBe(false);
    expect(isCronAuthorized(`Basic ${SECRET}`, SECRET)).toBe(false);
  });

  it("recusa segredo errado, inclusive de outro tamanho", () => {
    expect(isCronAuthorized(`Bearer ${"x".repeat(40)}`, SECRET)).toBe(false);
    expect(isCronAuthorized("Bearer curto", SECRET)).toBe(false);
  });

  it("aceita o segredo certo", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });
});

describe("runJobs", () => {
  it("roda todas as tarefas e isola a que falha", async () => {
    const ran: string[] = [];
    const results = await runJobs([
      { name: "a", run: async () => void ran.push("a") },
      {
        name: "quebra",
        run: async () => {
          throw new Error("boom");
        },
      },
      { name: "c", run: async () => (ran.push("c"), { tocados: 2 }) },
    ]);

    expect(ran).toEqual(["a", "c"]);
    expect(results.map((r) => [r.name, r.ok])).toEqual([
      ["a", true],
      ["quebra", false],
      ["c", true],
    ]);
    expect(results[1]).toMatchObject({ error: "boom" });
    expect(results[2]).toMatchObject({ summary: { tocados: 2 } });
  });

  it("passa o mesmo instante para todas as tarefas", async () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const seen: Date[] = [];
    await runJobs(
      [
        { name: "a", run: async (t) => void seen.push(t) },
        { name: "b", run: async (t) => void seen.push(t) },
      ],
      now,
    );
    expect(seen).toEqual([now, now]);
  });
});

describe("CRON_JOBS", () => {
  it("começa vazia na Fase 0 (nenhum comportamento muda)", () => {
    expect(CRON_JOBS).toEqual([]);
  });
});
