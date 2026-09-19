// Camada de IA on-device (React Native ExecuTorch 0.9.x).
//
// Arquitetura híbrida: o modelo Qwen3 roda no aparelho e conduz a conversa.
// Quando a intenção fica clara, chama UMA tool alinhada ao que o Judeu oferece:
//   - buscar_prestadores → serviço pontual (catálogo real)
//   - buscar_vagas       → emprego (vagas reais)
//   - montar_vaga        → empresa publicando vaga (rascunho pra revisão humana)
// A tool NÃO é resolvida pelo modelo — o app consulta o backend e devolve dado
// real. Assim honramos o RF-J4 ("não inventa prestadores/vagas") sem chave de
// LLM no servidor.
//
// NOTA de versão: escrito contra a API 0.9.2 verificada nos .d.ts instalados
// (`initExecutorch({ resourceFetcher })`, `useLLM({ model })`, `configure({ chatConfig, toolsConfig })`,
// `LLMTool`/`ToolCall`, `QWEN3_1_7B_QUANTIZED`). Se atualizar a lib, reconferir estes nomes.
import { initExecutorch, isAvailable, QWEN3_1_7B_QUANTIZED } from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";

import type {
  AppUser,
  Category,
  CreateJobPostingInput,
  JobContractType,
  JobPosting,
  JobShift,
  JobWeekday,
  Order,
  SavedAddress,
} from "@/lib/api";
import { TIME_RE } from "@/lib/format";

// Modelo padrão: Qwen3 1.7B quantizado — bom multilíngue (pt-BR) e suporta tool calling.
// Trocar por QWEN3_0_6B_QUANTIZED em aparelhos mais fracos, ou HAMMER2_1_1_5B_QUANTIZED
// se quiser priorizar precisão de function calling sobre conversa.
export const AI_MODEL = QWEN3_1_7B_QUANTIZED;

export const SEARCH_TOOL_NAME = "buscar_prestadores";
export const JOBS_SEARCH_TOOL_NAME = "buscar_vagas";

// Argumentos que o modelo preenche ao chamar cada tool.
export type SearchArgs = { categoria: string; termo?: string };
export type JobSearchArgs = { categoria?: string; termo?: string; contrato?: string };

export type AssistantCapabilities = { canPublishJobs: boolean };

let initialized = false;

// Registra o adapter de download de modelos. Idempotente e à prova de ambiente sem
// módulo nativo (Expo Go / web), onde não deve derrubar o app.
export function initAssistant(): void {
  if (initialized) return;
  try {
    initExecutorch({ resourceFetcher: ExpoResourceFetcher });
    initialized = true;
  } catch {
    // Módulo nativo ausente (ex.: Expo Go). O assistente só roda em dev build.
  }
}

// O runtime nativo do ExecuTorch está disponível neste dispositivo/binário?
// (false em Expo Go, web, ou Android 32-bit.)
export function aiAvailable(): boolean {
  try {
    return isAvailable;
  } catch {
    return false;
  }
}

const PERSONALIZATION_SAMPLE = 20;
const PERSONALIZATION_MIN_COUNT = 2;

// Conta ocorrências e devolve as mais frequentes, ignorando quem apareceu só uma
// vez (uma ocorrência não justifica dizer "você costuma buscar X").
function topFrequent(names: (string | null | undefined)[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= PERSONALIZATION_MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name]) => name);
}

export type ClientPersonalization = {
  firstName: string | null;
  city: string | null;
  topCategories: string[];
  canPublishJobs: boolean;
};

// Deriva o contexto do usuário a partir de dados reais já existentes no backend
// (perfil, endereços, pedidos) — nada é guardado localmente, sempre é buscado de
// novo, então o "conhecimento" do assistente sobre o usuário está sempre atual.
export function deriveClientPersonalization(
  user: AppUser | null,
  addresses: SavedAddress[],
  orders: Order[],
  canPublishJobs = false,
): ClientPersonalization {
  const firstName = user?.fullName.trim().split(/\s+/)[0] || null;
  const city = addresses.find((a) => a.isDefault)?.city ?? addresses[0]?.city ?? null;
  const recent = orders.slice(0, PERSONALIZATION_SAMPLE).map((o) => o.category?.name);
  return { firstName, city, topCategories: topFrequent(recent, 2), canPublishJobs };
}

// Formata o bloco de contexto do usuário para o system prompt. Vazio (sem
// cabeçalho nenhum) quando não há nenhum dado disponível, ex.: usuário novo.
function formatPersonalization(lines: string[]): string[] {
  return lines.length
    ? [
        "",
        "Contexto do usuário (use com naturalidade, não repita tudo a cada mensagem, não invente nada além disto):",
        ...lines,
      ]
    : [];
}

// System prompt em pt-BR: o modelo escolhe a intenção (serviço, emprego ou
// publicar vaga) e só então chama a tool certa, com as categorias reais injetadas.
export function buildSystemPrompt(
  categories: Category[],
  personalization?: ClientPersonalization,
): string {
  const lista = categories.length
    ? categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n")
    : "- reparos, limpeza, frete, beleza";
  const canPublish = personalization?.canPublishJobs === true;
  const contextLines: string[] = [];
  if (personalization?.firstName) contextLines.push(`Nome: ${personalization.firstName}`);
  if (personalization?.city) contextLines.push(`Cidade: ${personalization.city}`);
  if (personalization?.topCategories.length) {
    contextLines.push(`Costuma buscar: ${personalization.topCategories.join(", ")}`);
  }
  if (canPublish) contextLines.push("Perfil: empresa (pode publicar vagas)");
  return [
    "Você é o JudIA, assistente do Judeu — app de serviços locais e vagas de emprego em Palmas, Tocantins.",
    "A plataforma oferece só isto. Identifique o que a pessoa realmente quer e aja nisso, sem inventar outro produto:",
    "1. CONTRATAR SERVIÇO — alguém pra resolver um problema agora (faxina, encanador, frete, beleza…). Ferramenta: buscar_prestadores.",
    "2. PROCURAR EMPREGO — candidatar-se a vaga CLT, PJ, freelance ou temporário. Ferramenta: buscar_vagas.",
    "3. PUBLICAR VAGA — empresa contratando funcionário com escala e contrato. Ferramenta: montar_vaga.",
    ...formatPersonalization(contextLines),
    "Fale em português do Brasil, humano e direto. Varie cumprimento e pergunta; não pareça roteiro nem formulário.",
    "Reconheça em poucas palavras o que a pessoa disse — empatia curta quando fizer sentido — e só então pergunte ou aja.",
    "Se a intenção já estiver clara, chame a ferramenta na hora, sem interrogatório.",
    "Se puder ser mais de uma coisa (ex.: \"preciso de limpeza\" pode ser serviço pontual, emprego ou vaga pra publicar), NÃO chute a ferramenta. Faça UMA pergunta curta, no tom de quem quer acertar, mostrando só as opções que ainda fazem sentido.",
    "Exemplos de tom (varie, não copie): \"Beleza — você quer alguém pra resolver isso agora, ou está procurando uma vaga nessa área?\" / \"Entendi. É pra chamar um profissional pontual ou pra contratar alguém na empresa?\"",
    "No máximo duas perguntas no total. Depois, siga pelo caminho mais razoável e confirme em uma frase.",
    "Assim que identificar que é um serviço pontual, chame a ferramenta buscar_prestadores com a categoria adequada.",
    "Assim que identificar que está procurando emprego, chame a ferramenta buscar_vagas.",
    canPublish
      ? "Esta pessoa é empresa e PODE publicar vagas. Quando quiser contratar funcionário e você tiver categoria, título, descrição, contrato, salário (valor ou a combinar) e a escala (dias e HH:mm), chame montar_vaga. Não invente campo que ela não falou — pergunte, no máximo dois de cada vez."
      : "Esta pessoa NÃO é empresa neste app. NÃO chame montar_vaga. Se parecer que quer publicar vaga, explique com naturalidade que isso é para empresas cadastradas e pergunte se na verdade precisa de um prestador agora ou se está procurando emprego.",
    "NUNCA invente prestadores, vagas, empresas, nomes, notas, salários ou preços — use SEMPRE a ferramenta para trazer dados reais.",
    "Use SOMENTE as categorias da lista abaixo. Elas são tudo o que o Judeu atende hoje.",
    "Se o que a pessoa precisa não corresponder a nenhuma delas, NÃO chame a ferramenta: diga com franqueza que o Judeu ainda não atende isso e cite as categorias que existem.",
    "Não force um pedido dentro de uma categoria parecida só para conseguir buscar.",
    "",
    "Categorias disponíveis (use o identificador antes dos dois-pontos como valor de 'categoria'):",
    lista,
  ].join("\n");
}

// Schema da tool no formato function-calling (compreendido pelo Qwen3/Hammer).
// `LLMTool` é tipado como Object na lib, então passamos o objeto diretamente.
export function buildSearchTool(categories: Category[]): object {
  const slugs = categories.length
    ? categories.map((c) => c.slug)
    : ["reparos", "limpeza", "frete", "beleza"];
  const descricao = categories.length
    ? categories.map((c) => `${c.slug} (${c.name})`).join(", ")
    : "reparos, limpeza, frete, beleza";
  return {
    type: "function",
    function: {
      name: SEARCH_TOOL_NAME,
      description:
        "Busca prestadores de serviço reais cadastrados no Judeu, filtrando por categoria. " +
        "Chame quando a pessoa quiser contratar um serviço pontual (não emprego). Não invente prestadores.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            enum: slugs,
            description: `Categoria do serviço. Opções: ${descricao}.`,
          },
          termo: {
            type: "string",
            description:
              "Palavra-chave do serviço específico citado pelo usuário (ex.: 'vazamento', 'faxina', 'mudança'). Opcional.",
          },
        },
        required: ["categoria"],
      },
    },
  };
}

export function buildJobsSearchTool(categories: Category[]): object {
  const slugs = categories.length
    ? categories.map((c) => c.slug)
    : ["reparos", "limpeza", "frete", "beleza"];
  const descricao = categories.length
    ? categories.map((c) => `${c.slug} (${c.name})`).join(", ")
    : "reparos, limpeza, frete, beleza";
  return {
    type: "function",
    function: {
      name: JOBS_SEARCH_TOOL_NAME,
      description:
        "Busca vagas de emprego reais publicadas por empresas no Judeu. " +
        "Chame quando a pessoa estiver procurando trabalho ou emprego. Não invente vagas.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            enum: slugs,
            description: `Categoria da vaga, se a pessoa citou uma. Opções: ${descricao}. Opcional.`,
          },
          termo: {
            type: "string",
            description:
              "Cargo, palavra-chave ou área citada (ex.: 'auxiliar de limpeza', 'motorista'). Opcional.",
          },
          contrato: {
            type: "string",
            enum: CONTRACT_SLUGS.map((c) => c.slug),
            description: "Tipo de contrato, se a pessoa pediu: clt, pj, freelance ou temporario. Opcional.",
          },
        },
      },
    },
  };
}

export function buildAssistantTools(
  categories: Category[],
  capabilities: AssistantCapabilities = { canPublishJobs: false },
): object[] {
  const tools = [buildSearchTool(categories), buildJobsSearchTool(categories)];
  if (capabilities.canPublishJobs) tools.push(buildJobTool(categories));
  return tools;
}

// Limpa o texto cru do modelo antes de mostrar na bolha do chat.
// Precisamos de `displayToolCalls: true` para que a lib anexe a resposta do
// assistente ao messageHistory (com false ela é descartada), mas isso também
// faz a tool call cair no histórico — então tiramos ela aqui, junto com os
// blocos de raciocínio do Qwen3.
export function sanitizeReply(raw: string): string {
  const closed = raw.lastIndexOf("</think>");
  const withoutThinking =
    closed >= 0 ? raw.slice(closed + "</think>".length) : raw.includes("<think>") ? "" : raw;
  return withoutThinking
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    // tool call ainda chegando token a token, sem tag de fechamento
    .replace(/<tool_call>[\s\S]*$/, "")
    .replace(/\[\s*\{[\s\S]*"name"[\s\S]*\}\s*\]/g, "")
    .trim();
}

// O Qwen3 emite a tool call como <tool_call>{"name":…}</tool_call>. O
// parseToolCall da lib só reconhece o formato array ([{…}]) do Hammer, então
// não enxerga essa chamada e o executeToolCallback nunca dispara. Parseamos os
// dois formatos aqui para ter um caminho único de execução.
export function parseToolCall<T = Record<string, unknown>>(
  raw: string,
): { name: string; arguments: T } | null {
  type Call = { name?: string; arguments?: T };
  const json =
    raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/)?.[1] ??
    raw.match(/\[\s*\{[\s\S]*?\}\s*\]/)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Call | Call[];
    const call = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!call?.name) return null;
    return { name: call.name, arguments: (call.arguments ?? {}) as T };
  } catch {
    return null;
  }
}

export function parseToolCallArgs<T>(raw: string, toolName: string): T | null {
  const call = parseToolCall<T>(raw);
  if (!call || call.name !== toolName) return null;
  return call.arguments;
}

// Resolve o slug que o modelo escolheu para o id de categoria real do backend.
// Tolera acentos/caixa e casa por slug ou por nome.
export function resolveCategoryId(categories: Category[], categoria: string): string | undefined {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const alvo = norm(categoria);
  const match =
    categories.find((c) => norm(c.slug) === alvo) ??
    categories.find((c) => norm(c.name) === alvo) ??
    categories.find((c) => norm(c.name).includes(alvo) || alvo.includes(norm(c.slug)));
  return match?.id;
}

// ---------------------------------------------------------------------------
// Sessão de IA para montar uma vaga completa (empresa). Mesmo modelo/runtime
// da busca acima, mas sem 2º turno: não há dado real de backend pra reconciliar,
// então a proposta do modelo vai direto pra revisão humana antes de publicar.
// ---------------------------------------------------------------------------

export const JOB_TOOL_NAME = "montar_vaga";

export type JobDraftShiftArg = { dia_semana: string; inicio: string; fim: string };
export type JobDraftArgs = {
  categoria: string;
  titulo: string;
  descricao: string;
  contrato: string;
  salario_reais?: number;
  a_combinar?: boolean;
  turnos: JobDraftShiftArg[];
};

const WEEKDAY_SLUGS: { slug: string; value: JobWeekday }[] = [
  { slug: "segunda", value: "MONDAY" },
  { slug: "terca", value: "TUESDAY" },
  { slug: "quarta", value: "WEDNESDAY" },
  { slug: "quinta", value: "THURSDAY" },
  { slug: "sexta", value: "FRIDAY" },
  { slug: "sabado", value: "SATURDAY" },
  { slug: "domingo", value: "SUNDAY" },
];

const CONTRACT_SLUGS: { slug: string; value: JobContractType }[] = [
  { slug: "clt", value: "CLT" },
  { slug: "pj", value: "PJ" },
  { slug: "freelance", value: "FREELANCE" },
  { slug: "temporario", value: "TEMPORARY" },
];

export type CompanyPersonalization = {
  firstName: string | null;
  topCategory: string | null;
};

// Mesma ideia de deriveClientPersonalization, mas em cima do histórico de vagas
// já publicadas pela empresa — sem armazenamento novo, sempre buscado de novo.
export function deriveCompanyPersonalization(
  user: AppUser | null,
  jobPostings: JobPosting[],
): CompanyPersonalization {
  const firstName = user?.fullName.trim().split(/\s+/)[0] || null;
  const recent = jobPostings.slice(0, PERSONALIZATION_SAMPLE).map((j) => j.category.name);
  const [topCategory = null] = topFrequent(recent, 1);
  return { firstName, topCategory };
}

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function buildJobSystemPrompt(
  categories: Category[],
  personalization?: CompanyPersonalization,
): string {
  const lista = categories.length
    ? categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n")
    : "- reparos, limpeza, frete, beleza";
  const contextLines: string[] = [];
  if (personalization?.firstName) contextLines.push(`Nome: ${personalization.firstName}`);
  if (personalization?.topCategory) {
    contextLines.push(`Vagas publicadas antes: ${personalization.topCategory}`);
  }
  return [
    "Você é o JudIA ajudando uma empresa a publicar uma vaga de emprego no Judeu.",
    ...formatPersonalization(contextLines),
    "Primeiro tenha certeza de que é ISSO que ela quer. Publicar vaga = contratar funcionário (CLT, PJ, freelance ou temporário) com escala.",
    "Se parecer um serviço pontual (\"preciso de um encanador hoje\", \"alguém pra faxina nesta semana\"), NÃO monte a vaga. Diga com naturalidade que isso é serviço sob demanda, não emprego, e pergunte se mesmo assim ela quer publicar uma vaga ou se prefere um prestador.",
    "Fale em português do Brasil, humano e direto. Varie a forma de perguntar; não pareça um formulário.",
    "Reconheça brevemente o que a empresa descreveu antes de seguir.",
    "Pergunte o que faltar de um em um (no máximo dois de cada vez), como conversa: categoria, título, descrição, contrato (CLT, PJ, freelance ou temporário), salário (valor em reais ou a combinar) e a escala (dias da semana e horário de início/fim).",
    "Horários sempre no formato 24h HH:mm (ex.: 08:00, 17:30).",
    "Use SOMENTE as categorias da lista abaixo.",
    "Assim que tiver todos os dados que a empresa descreveu, chame a ferramenta montar_vaga com a vaga completa.",
    "NUNCA invente título, descrição, salário, contrato, dias ou horários que a empresa não mencionou.",
    "Não complete campos faltando com chute — pergunte.",
    "",
    "Categorias disponíveis (use o identificador antes dos dois-pontos como valor de 'categoria'):",
    lista,
  ].join("\n");
}

// Schema da tool no formato function-calling (compreendido pelo Qwen3/Hammer).
export function buildJobTool(categories: Category[]): object {
  const slugs = categories.length
    ? categories.map((c) => c.slug)
    : ["reparos", "limpeza", "frete", "beleza"];
  const descricao = categories.length
    ? categories.map((c) => `${c.slug} (${c.name})`).join(", ")
    : "reparos, limpeza, frete, beleza";
  return {
    type: "function",
    function: {
      name: JOB_TOOL_NAME,
      description:
        "Registra a vaga completa (categoria, título, descrição, contrato, salário e escala) que a empresa descreveu. " +
        "Chame só quando tiver todos os campos. Não invente dados.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            enum: slugs,
            description: `Categoria da vaga. Opções: ${descricao}.`,
          },
          titulo: { type: "string", description: "Título curto da vaga." },
          descricao: {
            type: "string",
            description: "Descrição da vaga: responsabilidades, requisitos, benefícios.",
          },
          contrato: {
            type: "string",
            enum: CONTRACT_SLUGS.map((c) => c.slug),
            description: "Tipo de contrato: clt, pj, freelance ou temporario.",
          },
          salario_reais: {
            type: "number",
            description: "Salário em reais. Omita se for a combinar.",
          },
          a_combinar: {
            type: "boolean",
            description: "true quando a empresa disse que o salário é a combinar.",
          },
          turnos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dia_semana: {
                  type: "string",
                  enum: WEEKDAY_SLUGS.map((w) => w.slug),
                  description: "Dia da semana do turno.",
                },
                inicio: { type: "string", description: "Horário de início, formato HH:mm." },
                fim: { type: "string", description: "Horário de término, formato HH:mm." },
              },
              required: ["dia_semana", "inicio", "fim"],
            },
          },
        },
        required: ["categoria", "titulo", "descricao", "contrato", "turnos"],
      },
    },
  };
}

export function resolveContractType(slug: string): JobContractType | undefined {
  const alvo = stripDiacritics(slug);
  return CONTRACT_SLUGS.find((c) => c.slug === alvo || c.value.toLowerCase() === alvo)?.value;
}

// Resolve o slug de dia da semana que o modelo escolheu (pt-BR, com ou sem
// acento) para o valor do enum WeekDay usado pela API.
export function resolveWeekday(slug: string): JobWeekday | undefined {
  const alvo = stripDiacritics(slug);
  return WEEKDAY_SLUGS.find((w) => stripDiacritics(w.slug) === alvo)?.value;
}

function toPositiveReais(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

// Converte a tool call em rascunho pronto pra revisão. null = payload incompleto
// ou inválido (o chat pede de novo, sem segundo turno do modelo).
export function parseJobDraftFromTool(
  args: JobDraftArgs,
  categories: Category[],
): CreateJobPostingInput | null {
  const title = args.titulo?.trim() ?? "";
  const description = args.descricao?.trim() ?? "";
  if (title.length < 3 || description.length < 10) return null;

  const categoryId = resolveCategoryId(categories, args.categoria ?? "");
  if (!categoryId) return null;

  const contractType = resolveContractType(args.contrato ?? "");
  if (!contractType) return null;

  const shifts: JobShift[] = (Array.isArray(args.turnos) ? args.turnos : [])
    .map((t) => {
      const weekday = resolveWeekday(t.dia_semana);
      if (!weekday || !TIME_RE.test(t.inicio) || !TIME_RE.test(t.fim) || t.inicio >= t.fim) {
        return null;
      }
      return { weekday, startTime: t.inicio, endTime: t.fim };
    })
    .filter((s): s is JobShift => s !== null);
  if (shifts.length === 0) return null;

  const combinado = args.a_combinar === true;
  const reais = toPositiveReais(args.salario_reais);
  if (!combinado && reais == null) return null;

  return {
    categoryId,
    title,
    description,
    contractType,
    salaryCents: combinado ? undefined : Math.round(reais! * 100),
    shifts,
  };
}
