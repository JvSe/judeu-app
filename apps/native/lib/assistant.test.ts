import { describe, expect, it, vi } from "vitest";

// assistant.ts importa o módulo nativo do ExecuTorch, que não roda (nem
// precisa rodar) neste teste — as funções aqui testadas são puras. Mocado pra
// evitar carregar react-native/Flow no ambiente Node do vitest.
vi.mock("react-native-executorch", () => ({
  initExecutorch: () => {},
  isAvailable: false,
  QWEN3_1_7B_QUANTIZED: "QWEN3_1_7B_QUANTIZED",
}));
vi.mock("react-native-executorch-expo-resource-fetcher", () => ({
  ExpoResourceFetcher: {},
}));

import type { AppUser, Category, JobPosting, Order, SavedAddress } from "./api";
import {
  buildAssistantTools,
  buildJobSystemPrompt,
  buildSystemPrompt,
  deriveClientPersonalization,
  deriveCompanyPersonalization,
  JOB_TOOL_NAME,
  JOBS_SEARCH_TOOL_NAME,
  parseJobDraftFromTool,
  parseToolCall,
  parseToolCallArgs,
  SEARCH_TOOL_NAME,
  type JobDraftArgs,
} from "./assistant";

function makeUser(fullName: string): AppUser {
  return {
    id: "u1",
    email: "a@a.com",
    fullName,
    phone: null,
    role: "CLIENT",
    avatarUrl: null,
    emailVerified: true,
    phoneVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeAddress(city: string, isDefault: boolean): SavedAddress {
  return {
    id: `addr-${city}-${isDefault}`,
    label: null,
    cep: null,
    street: "Rua X",
    number: null,
    complement: null,
    neighborhood: null,
    city,
    state: "TO",
    lat: 0,
    lng: 0,
    isDefault,
  };
}

function makeOrder(categoryName: string | null): Order {
  return {
    id: `order-${Math.random()}`,
    status: "COMPLETED",
    description: null,
    scheduledAt: null,
    priceCents: 0,
    platformFeeCents: 0,
    totalCents: 0,
    cancelReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    unreadMessages: 0,
    service: null,
    category: categoryName ? { id: "cat1", name: categoryName } : null,
    provider: null,
    client: { id: "u1", name: "Cliente", phone: null },
    payment: null,
    address: {} as Order["address"],
    events: [],
    tracking: {
      providerLat: null,
      providerLng: null,
      updatedAt: null,
      distanceKm: null,
      etaMin: null,
      route: null,
      arrived: false,
    },
  };
}

function makeJobPosting(categoryName: string): JobPosting {
  return {
    id: `job-${Math.random()}`,
    title: "Vaga",
    description: "",
    contractType: "CLT",
    salaryCents: null,
    status: "OPEN",
    category: { id: "cat1", name: categoryName },
    providerCompany: { id: "c1", name: "Empresa", companyName: null },
    shifts: [],
    applicantCount: 0,
    myApplication: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveClientPersonalization", () => {
  it("usuário novo (sem pedidos/endereços) devolve tudo vazio, exceto o nome", () => {
    const result = deriveClientPersonalization(makeUser("Ana Souza"), [], []);
    expect(result).toEqual({ firstName: "Ana", city: null, topCategories: [], canPublishJobs: false });
  });

  it("sem usuário logado, tudo nulo/vazio", () => {
    const result = deriveClientPersonalization(null, [], []);
    expect(result).toEqual({ firstName: null, city: null, topCategories: [], canPublishJobs: false });
  });

  it("pega o primeiro nome de um fullName com vários nomes", () => {
    const result = deriveClientPersonalization(makeUser("João Pedro Silva"), [], []);
    expect(result.firstName).toBe("João");
  });

  it("cidade vem do endereço padrão quando existe", () => {
    const addresses = [makeAddress("Araguaína", false), makeAddress("Palmas", true)];
    const result = deriveClientPersonalization(makeUser("Ana"), addresses, []);
    expect(result.city).toBe("Palmas");
  });

  it("sem endereço padrão, cai pro primeiro da lista", () => {
    const addresses = [makeAddress("Araguaína", false), makeAddress("Gurupi", false)];
    const result = deriveClientPersonalization(makeUser("Ana"), addresses, []);
    expect(result.city).toBe("Araguaína");
  });

  it("categoria só entra com 2+ ocorrências, ordenada por frequência, cortada em 2", () => {
    const orders = [
      ...Array(3).fill(null).map(() => makeOrder("Limpeza")),
      ...Array(2).fill(null).map(() => makeOrder("Reparos")),
      makeOrder("Frete"), // só 1 ocorrência, não entra
    ];
    const result = deriveClientPersonalization(makeUser("Ana"), [], orders);
    expect(result.topCategories).toEqual(["Limpeza", "Reparos"]);
  });

  it("pedidos com categoria nula não quebram nem contam", () => {
    const orders = [makeOrder(null), makeOrder(null), makeOrder("Beleza"), makeOrder("Beleza")];
    const result = deriveClientPersonalization(makeUser("Ana"), [], orders);
    expect(result.topCategories).toEqual(["Beleza"]);
  });

  it("marca canPublishJobs quando a pessoa é empresa", () => {
    const result = deriveClientPersonalization(makeUser("Ana"), [], [], true);
    expect(result.canPublishJobs).toBe(true);
  });

  it("olha só os 20 pedidos mais recentes (categoria fora da amostra é ignorada)", () => {
    const orders = [
      ...Array(20).fill(null).map(() => makeOrder("Limpeza")),
      ...Array(5).fill(null).map(() => makeOrder("Frete")), // fora da amostra dos 20 primeiros
    ];
    const result = deriveClientPersonalization(makeUser("Ana"), [], orders);
    expect(result.topCategories).toEqual(["Limpeza"]);
  });
});

describe("deriveCompanyPersonalization", () => {
  it("empresa nova (sem vagas) devolve categoria nula, mantém nome", () => {
    const result = deriveCompanyPersonalization(makeUser("Carla Nunes"), []);
    expect(result).toEqual({ firstName: "Carla", topCategory: null });
  });

  it("categoria mais frequente com 2+ ocorrências vira topCategory", () => {
    const postings = [makeJobPosting("Limpeza"), makeJobPosting("Limpeza"), makeJobPosting("Frete")];
    const result = deriveCompanyPersonalization(makeUser("Carla"), postings);
    expect(result.topCategory).toBe("Limpeza");
  });

  it("com uma única vaga publicada, não chega a 2 ocorrências: topCategory nulo", () => {
    const result = deriveCompanyPersonalization(makeUser("Carla"), [makeJobPosting("Limpeza")]);
    expect(result.topCategory).toBeNull();
  });
});

describe("buildSystemPrompt", () => {
  it("sem personalização (parâmetro omitido), não inclui o bloco de contexto", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).not.toContain("Contexto do usuário");
  });

  it("usuário novo (personalização vazia) também não inclui o bloco de contexto", () => {
    const prompt = buildSystemPrompt([], {
      firstName: null,
      city: null,
      topCategories: [],
      canPublishJobs: false,
    });
    expect(prompt).not.toContain("Contexto do usuário");
  });

  it("com personalização completa, inclui nome, cidade e categorias", () => {
    const prompt = buildSystemPrompt([], {
      firstName: "Ana",
      city: "Palmas",
      topCategories: ["Limpeza", "Reparos"],
      canPublishJobs: false,
    });
    expect(prompt).toContain("Contexto do usuário");
    expect(prompt).toContain("Nome: Ana");
    expect(prompt).toContain("Cidade: Palmas");
    expect(prompt).toContain("Costuma buscar: Limpeza, Reparos");
  });

  it("mantém as instruções principais de tool-calling e anti-alucinação", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("chame a ferramenta buscar_prestadores");
    expect(prompt).toContain("chame a ferramenta buscar_vagas");
    expect(prompt).toContain("NUNCA invente prestadores, vagas, empresas, nomes, notas, salários ou preços");
  });

  it("sem empresa, não libera montar_vaga e pede pra esclarecer a intenção", () => {
    const prompt = buildSystemPrompt([], {
      firstName: "Ana",
      city: null,
      topCategories: [],
      canPublishJobs: false,
    });
    expect(prompt).toContain("NÃO chame montar_vaga");
    expect(prompt).toContain("NÃO chute a ferramenta");
    expect(prompt).not.toContain("Esta pessoa é empresa e PODE publicar vagas");
  });

  it("com empresa, libera montar_vaga e marca o perfil no contexto", () => {
    const prompt = buildSystemPrompt([], {
      firstName: "Carla",
      city: "Palmas",
      topCategories: [],
      canPublishJobs: true,
    });
    expect(prompt).toContain("Perfil: empresa (pode publicar vagas)");
    expect(prompt).toContain("chame montar_vaga");
    expect(prompt).not.toContain("NÃO chame montar_vaga");
  });
});

describe("buildJobSystemPrompt", () => {
  it("sem personalização, não inclui o bloco de contexto", () => {
    const prompt = buildJobSystemPrompt([]);
    expect(prompt).not.toContain("Contexto do usuário");
  });

  it("com personalização completa, inclui nome e categoria de vaga anterior", () => {
    const prompt = buildJobSystemPrompt([], { firstName: "Carla", topCategory: "Limpeza" });
    expect(prompt).toContain("Nome: Carla");
    expect(prompt).toContain("Vagas publicadas antes: Limpeza");
  });

  it("mantém as instruções principais de tool-calling e anti-alucinação", () => {
    const prompt = buildJobSystemPrompt([]);
    expect(prompt).toContain("chame a ferramenta montar_vaga");
    expect(prompt).toContain("NUNCA invente título, descrição, salário, contrato, dias ou horários");
    expect(prompt).toContain("Se parecer um serviço pontual");
  });

  it("injeta as categorias reais no prompt", () => {
    const prompt = buildJobSystemPrompt([
      { id: "c1", slug: "limpeza", name: "Limpeza", icon: null, count: 0, featured: false },
    ]);
    expect(prompt).toContain("- limpeza: Limpeza");
  });
});

const CATEGORIES: Category[] = [
  { id: "cat-limpeza", slug: "limpeza", name: "Limpeza", icon: null, count: 0, featured: false },
  { id: "cat-frete", slug: "frete", name: "Frete", icon: null, count: 0, featured: false },
];

function validArgs(over: Partial<JobDraftArgs> = {}): JobDraftArgs {
  return {
    categoria: "limpeza",
    titulo: "Auxiliar de limpeza",
    descricao: "Limpeza de escritórios e áreas comuns.",
    contrato: "clt",
    salario_reais: 1800,
    turnos: [{ dia_semana: "segunda", inicio: "08:00", fim: "17:00" }],
    ...over,
  };
}

describe("parseJobDraftFromTool", () => {
  it("slug da categoria vira o id real e contrato clt vira CLT", () => {
    const draft = parseJobDraftFromTool(validArgs(), CATEGORIES);
    expect(draft).toMatchObject({
      categoryId: "cat-limpeza",
      title: "Auxiliar de limpeza",
      contractType: "CLT",
      salaryCents: 180000,
    });
    expect(draft?.shifts).toEqual([{ weekday: "MONDAY", startTime: "08:00", endTime: "17:00" }]);
  });

  it("a_combinar true omite salaryCents", () => {
    const draft = parseJobDraftFromTool(validArgs({ a_combinar: true, salario_reais: undefined }), CATEGORIES);
    expect(draft?.salaryCents).toBeUndefined();
  });

  it("turno inválido é descartado; se sobrar algum válido, segue", () => {
    const draft = parseJobDraftFromTool(
      validArgs({
        turnos: [
          { dia_semana: "segunda", inicio: "08:00", fim: "07:00" },
          { dia_semana: "terca", inicio: "09:00", fim: "18:00" },
        ],
      }),
      CATEGORIES,
    );
    expect(draft?.shifts).toEqual([{ weekday: "TUESDAY", startTime: "09:00", endTime: "18:00" }]);
  });

  it("todos os turnos inválidos devolvem null", () => {
    const draft = parseJobDraftFromTool(
      validArgs({ turnos: [{ dia_semana: "segunda", inicio: "08:00", fim: "07:00" }] }),
      CATEGORIES,
    );
    expect(draft).toBeNull();
  });

  it("payload incompleto (título curto, categoria desconhecida, salário ausente) devolve null", () => {
    expect(parseJobDraftFromTool(validArgs({ titulo: "AB" }), CATEGORIES)).toBeNull();
    expect(parseJobDraftFromTool(validArgs({ categoria: "astronauta" }), CATEGORIES)).toBeNull();
    expect(parseJobDraftFromTool(validArgs({ salario_reais: undefined, a_combinar: false }), CATEGORIES)).toBeNull();
  });
});

describe("parseToolCall", () => {
  it("lê o formato Qwen <tool_call> e devolve o nome certo", () => {
    const raw = `<tool_call>{"name":"${JOBS_SEARCH_TOOL_NAME}","arguments":{"termo":"motorista"}}</tool_call>`;
    expect(parseToolCall(raw)).toEqual({
      name: JOBS_SEARCH_TOOL_NAME,
      arguments: { termo: "motorista" },
    });
  });

  it("lê o formato Hammer [{name, arguments}]", () => {
    const raw = `[{"name":"${SEARCH_TOOL_NAME}","arguments":{"categoria":"limpeza"}}]`;
    expect(parseToolCallArgs(raw, SEARCH_TOOL_NAME)).toEqual({ categoria: "limpeza" });
  });

  it("argumentos ausentes viram objeto vazio (busca de vagas sem filtro)", () => {
    const raw = `<tool_call>{"name":"${JOBS_SEARCH_TOOL_NAME}"}</tool_call>`;
    expect(parseToolCall(raw)).toEqual({ name: JOBS_SEARCH_TOOL_NAME, arguments: {} });
  });

  it("tool errada em parseToolCallArgs devolve null", () => {
    const raw = `<tool_call>{"name":"${SEARCH_TOOL_NAME}","arguments":{"categoria":"limpeza"}}</tool_call>`;
    expect(parseToolCallArgs(raw, JOB_TOOL_NAME)).toBeNull();
  });
});

describe("buildAssistantTools", () => {
  it("sempre inclui busca de prestador e de vagas", () => {
    const tools = buildAssistantTools(CATEGORIES);
    const names = tools.map((t) => (t as { function: { name: string } }).function.name);
    expect(names).toEqual([SEARCH_TOOL_NAME, JOBS_SEARCH_TOOL_NAME]);
  });

  it("só inclui montar_vaga quando a pessoa é empresa", () => {
    const tools = buildAssistantTools(CATEGORIES, { canPublishJobs: true });
    const names = tools.map((t) => (t as { function: { name: string } }).function.name);
    expect(names).toEqual([SEARCH_TOOL_NAME, JOBS_SEARCH_TOOL_NAME, JOB_TOOL_NAME]);
  });
});
