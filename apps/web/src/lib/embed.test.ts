import { describe, expect, it } from "vitest";

import { firstEmbed } from "./embed";

describe("firstEmbed", () => {
  it("array vazio vira null", () => {
    expect(firstEmbed([])).toBeNull();
  });
  it("array com item devolve o primeiro", () => {
    expect(firstEmbed([{ id: "p1" }, { id: "p2" }])).toEqual({ id: "p1" });
  });
  it("objeto passa direto", () => {
    expect(firstEmbed({ id: "p1" })).toEqual({ id: "p1" });
  });
  it("null/undefined viram null", () => {
    expect(firstEmbed(null)).toBeNull();
    expect(firstEmbed(undefined)).toBeNull();
  });
});
