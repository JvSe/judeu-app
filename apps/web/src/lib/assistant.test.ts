import { describe, expect, it } from "vitest";

import { actionFromToolUse, buildTools, keywordAction, keywordRisk, resolveCategory } from "./assistant";

const cats = [
  { id: "c-rep", slug: "reparos", name: "Reparos" },
  { id: "c-lim", slug: "limpeza", name: "Limpeza" },
  { id: "c-fre", slug: "frete", name: "Frete e mudança" },
];

describe("resolveCategory", () => {
  it("casa slug, nome e ignora acento/caixa", () => {
    expect(resolveCategory(cats, "REPAROS")?.id).toBe("c-rep");
    expect(resolveCategory(cats, "frete e mudanca")?.id).toBe("c-fre");
    expect(resolveCategory(cats, "")).toBeUndefined();
  });
});

describe("keywordAction (sem IA)", () => {
  it("ofício pelos sinais → prestadores", () => {
    expect(keywordAction("Tenho um vazamento na pia", cats).action).toMatchObject({
      type: "providers",
      categoryId: "c-rep",
    });
    expect(keywordAction("preciso de uma diarista amanhã", cats).action).toMatchObject({ categoryId: "c-lim" });
  });

  it("emprego → vagas", () => {
    expect(keywordAction("Estou procurando emprego", cats).action).toMatchObject({ type: "jobs" });
  });

  it("recado → pedido de ajuda com a frase do usuário", () => {
    expect(keywordAction("Buscar documentos na copiadora e deixar no trabalho", cats).action).toEqual({
      type: "help_request",
      description: "Buscar documentos na copiadora e deixar no trabalho",
      categoryId: null,
      priceCents: null,
      riskLevel: 1,
    });
  });

  it("frase curta demais → pede mais detalhes", () => {
    expect(keywordAction("oi", cats).action).toBeNull();
  });
});

describe("actionFromToolUse", () => {
  it("buscar_prestadores com categoria válida", () => {
    expect(actionFromToolUse({ name: "buscar_prestadores", input: { categoria: "reparos", termo: "tomada" } }, cats)).toEqual({
      type: "providers",
      categoryId: "c-rep",
      categoryName: "Reparos",
      term: "tomada",
    });
  });

  it("categoria inventada → sem ação", () => {
    expect(actionFromToolUse({ name: "buscar_prestadores", input: { categoria: "astronauta" } }, cats)).toBeNull();
  });

  it("pedir_ajuda converte reais em centavos", () => {
    expect(
      actionFromToolUse(
        { name: "pedir_ajuda", input: { descricao: "Pegar remédio na farmácia", valor_reais: 25 } },
        cats,
      ),
    ).toEqual({
      type: "help_request",
      description: "Pegar remédio na farmácia",
      categoryId: null,
      priceCents: 2500,
      riskLevel: 1,
    });
  });

  it("pedir_ajuda leva o nível de risco sugerido", () => {
    expect(
      actionFromToolUse(
        { name: "pedir_ajuda", input: { descricao: "Trocar o soquete da lâmpada da sala", nivel_risco: 3 } },
        cats,
      ),
    ).toMatchObject({ type: "help_request", riskLevel: 3 });
  });

  it("entrada inválida → sem ação", () => {
    expect(actionFromToolUse({ name: "pedir_ajuda", input: { descricao: "oi" } }, cats)).toBeNull();
    expect(actionFromToolUse({ name: "outra", input: {} }, cats)).toBeNull();
  });
});

describe("buildTools", () => {
  it("restringe categoria às do banco", () => {
    const tool = buildTools(cats)[0];
    expect((tool.input_schema.properties as Record<string, { enum?: string[] }>).categoria.enum).toEqual([
      "reparos",
      "limpeza",
      "frete",
    ]);
  });
});

describe("keywordRisk / reserva sem IA", () => {
  it("detecta níveis", () => {
    expect(keywordRisk("buscar remédio na farmácia")).toBe(1);
    expect(keywordRisk("Trocar o soquete da lâmpada")).toBe(3);
    expect(keywordRisk("Tem cheiro de gás aqui")).toBe(4);
    expect(keywordRisk("Buscar a nota do que gastei no mercado")).toBe(1);
    expect(keywordRisk("Levar o carro pra abastecer gasolina")).toBe(1);
  });
  it("nível 4 não abre pedido", () => {
    expect(keywordAction("Instalar o botijão de gás novo", cats).action).toBeNull();
  });
});
