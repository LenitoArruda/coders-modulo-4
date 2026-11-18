import { describe, expect, it } from "vitest";

import { EXPERT_CATALOG, getExpertById, isExpertId } from "./expert-catalog";

describe("EXPERT_CATALOG", () => {
  it("contém nove Experts na ordem de exibição exigida", () => {
    expect(EXPERT_CATALOG.map((expert) => expert.id)).toEqual([
      "cto",
      "cmo",
      "sales-director",
      "customer-success-director",
      "customer-hero-director",
      "ceo",
      "cfo",
      "coo",
      "cpo",
    ]);
  });

  it("cada Expert tem identidade, papel, escopo, tom e ao menos três sugestões em inglês", () => {
    for (const expert of EXPERT_CATALOG) {
      expect(expert.name).toMatch(/Expert$/);
      expect(expert.role.length).toBeGreaterThan(0);
      expect(expert.scope.length).toBeGreaterThan(0);
      expect(expert.tone.length).toBeGreaterThan(0);
      expect(expert.suggestions.length).toBeGreaterThanOrEqual(3);

      for (const suggestion of expert.suggestions) {
        expect(suggestion.trim()).toBe(suggestion);
        expect(suggestion.length).toBeGreaterThan(10);
        expect(suggestion).not.toMatch(/[áéíóúâêôãõç]/);
      }
    }
  });

  it("ids são únicos e reconhecidos pelo catálogo", () => {
    const ids = EXPERT_CATALOG.map((expert) => expert.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isExpertId(id)).toBe(true);
    }
    expect(isExpertId("not-an-expert")).toBe(false);
  });

  it("getExpertById retorna o Expert correto ou null", () => {
    expect(getExpertById("ceo")?.name).toBe("CEO Expert");
    expect(getExpertById("unknown")).toBeNull();
  });
});
