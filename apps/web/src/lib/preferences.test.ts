import { describe, expect, it } from "vitest";

import { meetsPreferences } from "./preferences";

const veteran = { ratingAvg: 4.9, ratingCount: 60, completedCount: 62, gender: "F" };
const newbie = { ratingAvg: 0, ratingCount: 0, completedCount: 0, gender: "M" };

describe("meetsPreferences", () => {
  it("sem preferência, todos passam", () => {
    expect(meetsPreferences(newbie, null)).toBe(true);
    expect(meetsPreferences(newbie, {})).toBe(true);
  });
  it("nota mínima exige avaliações", () => {
    expect(meetsPreferences(veteran, { minRating: 4.8 })).toBe(true);
    expect(meetsPreferences({ ...veteran, ratingAvg: 4.7 }, { minRating: 4.8 })).toBe(false);
    expect(meetsPreferences({ ...newbie, ratingAvg: 5 }, { minRating: 4.8 })).toBe(false);
  });
  it("tarefas concluídas", () => {
    expect(meetsPreferences(veteran, { minCompleted: 50 })).toBe(true);
    expect(meetsPreferences(newbie, { minCompleted: 50 })).toBe(false);
  });
  it("só mulheres", () => {
    expect(meetsPreferences(veteran, { gender: "F" })).toBe(true);
    expect(meetsPreferences(newbie, { gender: "F" })).toBe(false);
    expect(meetsPreferences({ ...veteran, gender: null }, { gender: "F" })).toBe(false);
  });
});
