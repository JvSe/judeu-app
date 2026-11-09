import Anthropic from "@anthropic-ai/sdk";
import { env } from "@judeu/env/server";
import { z } from "zod";

import { type CategoryDTO, listCategories } from "./catalog";
import { DEFAULT_CONFIG, getConfig } from "./config";
import { supabase } from "./db";
import { RISK_RUBRIC, normalizeRisk } from "./risk";

// Assistente em nuvem: reserva da JudIA quando o modelo não roda no aparelho
// (Expo Go, web, aparelho sem suporte). Mesmo roteiro do on-device
// (apps/native/lib/assistant.ts): classificar a intenção e escolher UMA
// ferramenta. A ferramenta não é executada aqui — o app recebe a ação e
// consulta o catálogo real, como já faz com o modelo local.
//
// Sem ANTHROPIC_API_KEY (ou se a API falhar/recusar), cai numa classificação
// por palavras-chave com as categorias do banco.

export const CLOUD_MODEL = "claude-haiku-5-5";
const MAX_HISTORY = 10;

export type AssistantAction =
  | { type: "providers"; categoryId: string; categoryName: string; term: string | null }
  | {
      type: "help_request";
      description: string;
      categoryId: string | null;
      priceCents: number | null;
      /** Sugestão de risco da IA (1–3); o servidor só usa para subir o nível. */
      riskLevel: number;
    }
  | { type: "jobs"; categoryId: string | null; term: string | null };

export type AssistantReply = {
  reply: string;
  action: AssistantAction | null;
  source: "claude" | "keywords";
  conversationId: string | null;
};

export type HistoryTurn = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Mesmo casamento do app: slug, nome, ou um contém o outro (sem acento/caixa). */
export function resolveCategory(
  categories: Pick<CategoryDTO, "id" | "slug" | "name">[],
  value: string,
): Pick<CategoryDTO, "id" | "slug" | "name"> | undefined {
  const alvo = norm(value);
  if (!alvo) return undefined;
  return (
    categories.find((c) => norm(c.slug) === alvo) ??
    categories.find((c) => norm(c.name) === alvo) ??
    categories.find((c) => norm(c.name).includes(alvo) || alvo.includes(norm(c.slug)))
  );
}

// ---------------------------------------------------------------------------
// Reserva sem IA: palavras-chave
// ---------------------------------------------------------------------------

const JOB_WORDS = ["vaga", "emprego", "trabalhar", "curriculo", "contratando"];

/** Sinais de ofício convencional, por categoria-base (mesmos sinais do prompt). */
const TRADE_SIGNALS: Record<string, string[]> = {
  reparos: ["vazamento", "eletric", "encanamento", "tomada", "chuveiro", "torneira", "conserto", "consertar", "reparo"],
  limpeza: ["faxina", "diarista", "limpeza", "limpar"],
  frete: ["mudanca", "frete", "carreto", "moveis"],
  beleza: ["corte", "cabelo", "unha", "manicure", "barbeiro", "maquiagem"],
};

/** Sinais de risco por palavra-chave (reserva sem IA); vale o maior encontrado. */
const RISK_SIGNALS: [number, string[]][] = [
  [4, ["gas", "botijao", "vazamento de gas", "poda de arvore"]],
  [3, ["fiacao", "soquete", "tomada", "disjuntor", "eletric", "telhado", "laje", "encanamento"]],
  [2, ["montar movel", "furar", "pendurar", "prateleira", "chuveiro", "desentupir"]],
];

export function keywordRisk(message: string): number {
  const text = norm(message);
  // Palavra inteira no início ("gas" não pode casar "gastar"/"gasolina").
  const has = (w: string) => new RegExp(`(^|[^a-z])${w}`).test(text) && (w.length > 4 || new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(text));
  for (const [level, words] of RISK_SIGNALS) if (words.some(has)) return level;
  return 1;
}

export function keywordAction(
  message: string,
  categories: Pick<CategoryDTO, "id" | "slug" | "name">[],
): AssistantReply {
  const text = norm(message);
  if (JOB_WORDS.some((w) => text.includes(w))) {
    return {
      reply: "Separei as vagas abertas para você dar uma olhada.",
      action: { type: "jobs", categoryId: null, term: null },
      source: "keywords",
      conversationId: null,
    };
  }

  const byName = categories.find((c) => text.includes(norm(c.name)) || text.includes(norm(c.slug)));
  const bySignal = byName
    ? undefined
    : Object.entries(TRADE_SIGNALS)
        .filter(([, words]) => words.some((w) => text.includes(w)))
        .map(([slug]) => resolveCategory(categories, slug))
        .find(Boolean);
  const category = byName ?? bySignal;
  if (category) {
    return {
      reply: `Isso parece ser de ${category.name}. Veja quem está disponível perto de você.`,
      action: { type: "providers", categoryId: category.id, categoryName: category.name, term: null },
      source: "keywords",
      conversationId: null,
    };
  }

  const risk = keywordRisk(message);
  if (risk === 4) {
    return { reply: FORBIDDEN_REPLY, action: null, source: "keywords", conversationId: null };
  }
  if (message.trim().length >= 8) {
    return {
      reply: "Vou publicar como um pedido de ajuda: quem estiver perto pode aceitar.",
      action: { type: "help_request", description: message.trim(), categoryId: null, priceCents: null, riskLevel: risk },
      source: "keywords",
      conversationId: null,
    };
  }
  return {
    reply: "Me conta um pouco mais do que você precisa, com uma frase completa.",
    action: null,
    source: "keywords",
    conversationId: null,
  };
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

const DEFAULT_AREA_LABEL = DEFAULT_CONFIG.serviceAreaLabel;

export function buildSystemPrompt(
  categories: Pick<CategoryDTO, "slug" | "name">[],
  areaLabel = DEFAULT_AREA_LABEL,
): string {
  const lista = categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n");
  return [
    `Você é o JudIA, assistente do Ajuda+ — app para chamar pessoas perto de você em ${areaLabel}.`,
    "Classifique a intenção em UM destes casos e use a ferramenta correspondente:",
    "A) SERVIÇO CONVENCIONAL — ofício da lista de categorias (ex.: reparos, limpeza, frete/mudança, beleza) → buscar_prestadores.",
    "B) AJUDA DIFERENTE / RECADO — buscar e deixar algo, copiadora, compra, fila, favor, 'preciso de alguém' → pedir_ajuda.",
    "C) EMPREGO — só se a pessoa pedir vaga ou trabalho → buscar_vagas.",
    "Se não for claramente um ofício da lista, trate como B. Nunca encaixe à força numa categoria.",
    "Fale em português do Brasil, curto e humano. Se a intenção já estiver clara, use a ferramenta na hora, com uma frase curta antes.",
    "Se faltar informação essencial, faça no máximo uma pergunta, sem ferramenta.",
    "Em pedir_ajuda, a descrição é uma frase completa do que fazer. Não peça endereço — o app pede depois do aceite.",
    "Nunca invente prestadores, vagas, nomes, notas ou preços.",
    "",
    RISK_RUBRIC,
    "Em pedir_ajuda, sempre informe nivel_risco. Se for 4, ainda assim chame a ferramenta (o app explica que não pode).",
    "",
    "Categorias (use o identificador antes dos dois-pontos):",
    lista,
  ].join("\n");
}

export function buildTools(categories: Pick<CategoryDTO, "slug" | "name">[]): Anthropic.Tool[] {
  const slugs = categories.map((c) => c.slug);
  const categoria = slugs.length ? { type: "string" as const, enum: slugs } : { type: "string" as const };
  return [
    {
      name: "buscar_prestadores",
      description:
        "Busca profissionais de um ofício convencional da lista de categorias. Use só quando o pedido for claramente um desses ofícios.",
      input_schema: {
        type: "object",
        properties: {
          categoria: { ...categoria, description: "Categoria do ofício." },
          termo: { type: "string", description: "Palavra-chave do serviço citado (ex.: 'vazamento'). Opcional." },
        },
        required: ["categoria"],
      },
    },
    {
      name: "pedir_ajuda",
      description:
        "Abre um pedido de ajuda aberto (recado, buscar/deixar, favor, fila, compra, pedido genérico de 'alguém').",
      input_schema: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "O que a pessoa precisa, em uma ou duas frases completas." },
          categoria: { ...categoria, description: "Categoria, se o pedido se aproximar de uma. Opcional." },
          valor_reais: { type: "number", description: "Valor que a pessoa ofereceu, em reais, se citou. Opcional." },
          nivel_risco: {
            type: "integer",
            enum: [1, 2, 3, 4],
            description: "Risco da tarefa conforme a rubrica do sistema (1 a 4). Na dúvida, o maior.",
          },
        },
        required: ["descricao", "nivel_risco"],
      },
    },
    {
      name: "buscar_vagas",
      description: "Busca vagas de emprego reais. Use só quando a pessoa procurar trabalho.",
      input_schema: {
        type: "object",
        properties: {
          categoria: { ...categoria, description: "Área da vaga, se citada. Opcional." },
          termo: { type: "string", description: "Cargo ou palavra-chave. Opcional." },
        },
        required: [],
      },
    },
  ];
}

const providersInput = z.object({ categoria: z.string().min(1), termo: z.string().optional() });
const helpInput = z.object({
  descricao: z.string().trim().min(8),
  categoria: z.string().optional(),
  valor_reais: z.number().positive().optional(),
  nivel_risco: z.number().int().min(1).max(4).optional(),
});

export const FORBIDDEN_REPLY =
  "Esse tipo de tarefa não pode ser feito pelo app, por segurança. Se for urgente (gás, fiação pegando fogo, alguém passando mal), ligue 193 ou 192.";
const jobsInput = z.object({ categoria: z.string().optional(), termo: z.string().optional() });

/** Converte a chamada de ferramenta do modelo numa ação do app, validando a entrada. */
export function actionFromToolUse(
  tool: { name: string; input: unknown },
  categories: Pick<CategoryDTO, "id" | "slug" | "name">[],
): AssistantAction | null {
  if (tool.name === "buscar_prestadores") {
    const p = providersInput.safeParse(tool.input);
    const cat = p.success ? resolveCategory(categories, p.data.categoria) : undefined;
    return cat
      ? { type: "providers", categoryId: cat.id, categoryName: cat.name, term: p.data?.termo?.trim() || null }
      : null;
  }
  if (tool.name === "pedir_ajuda") {
    const p = helpInput.safeParse(tool.input);
    if (!p.success) return null;
    const cat = p.data.categoria ? resolveCategory(categories, p.data.categoria) : undefined;
    return {
      type: "help_request",
      description: p.data.descricao,
      categoryId: cat?.id ?? null,
      priceCents: p.data.valor_reais ? Math.round(p.data.valor_reais * 100) : null,
      riskLevel: normalizeRisk(p.data.nivel_risco),
    };
  }
  if (tool.name === "buscar_vagas") {
    const p = jobsInput.safeParse(tool.input);
    if (!p.success) return null;
    const cat = p.data.categoria ? resolveCategory(categories, p.data.categoria) : undefined;
    return { type: "jobs", categoryId: cat?.id ?? null, term: p.data.termo?.trim() || null };
  }
  return null;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
  return client;
}

async function askClaude(
  history: HistoryTurn[],
  message: string,
  categories: CategoryDTO[],
): Promise<AssistantReply | null> {
  const response = await anthropic().messages.create({
    model: CLOUD_MODEL,
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(categories, (await getConfig()).serviceAreaLabel),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: buildTools(categories),
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    messages: [
      ...history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: message },
    ],
  });

  if (response.stop_reason === "refusal") return null; // cai nas palavras-chave

  let reply = "";
  let action: AssistantAction | null = null;
  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
    else if (block.type === "tool_use" && !action) {
      action = actionFromToolUse({ name: block.name, input: block.input }, categories);
    }
  }
  reply = reply.trim();
  if (action?.type === "help_request" && action.riskLevel === 4) {
    return { reply: FORBIDDEN_REPLY, action: null, source: "claude", conversationId: null };
  }
  if (!reply && !action) return null;
  return {
    reply: reply || "Pronto, encontrei um caminho para o seu pedido.",
    action,
    source: "claude",
    conversationId: null,
  };
}

// ---------------------------------------------------------------------------
// Persistência (AiConversation / AiMessage)
// ---------------------------------------------------------------------------

async function persistExchange(
  userId: string,
  conversationId: string | null,
  message: string,
  answer: AssistantReply,
): Promise<string | null> {
  try {
    let id = conversationId;
    if (id) {
      const { data } = await supabase.from("aiconversation").select("userId").eq("id", id).maybeSingle();
      if (data?.userId !== userId) id = null;
    }
    const now = new Date().toISOString();
    if (!id) {
      id = crypto.randomUUID();
      await supabase
        .from("aiconversation")
        .insert({ id, userId, title: message.slice(0, 80), createdAt: now, updatedAt: now });
    } else {
      await supabase.from("aiconversation").update({ updatedAt: now }).eq("id", id);
    }
    await supabase.from("aimessage").insert([
      { id: crypto.randomUUID(), conversationId: id, role: "USER", content: message, createdAt: now },
      {
        id: crypto.randomUUID(),
        conversationId: id,
        role: "ASSISTANT",
        content: JSON.stringify({ reply: answer.reply, action: answer.action, source: answer.source }),
        createdAt: now,
      },
    ]);
    return id;
  } catch (err) {
    console.warn("[assistant] conversa não registrada:", err);
    return conversationId;
  }
}

export async function runAssistant(
  userId: string,
  input: { message: string; history: HistoryTurn[]; conversationId: string | null },
): Promise<AssistantReply> {
  const categories = await listCategories();
  let answer: AssistantReply | null = null;

  if (env.ANTHROPIC_API_KEY) {
    try {
      answer = await askClaude(input.history, input.message, categories);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        console.warn("[assistant] limite da API atingido; usando palavras-chave");
      } else if (err instanceof Anthropic.APIError) {
        console.error(`[assistant] erro da API (${err.status}); usando palavras-chave:`, err.message);
      } else {
        console.error("[assistant] falha inesperada; usando palavras-chave:", err);
      }
    }
  }
  answer ??= keywordAction(input.message, categories);

  const conversationId = await persistExchange(userId, input.conversationId, input.message, answer);
  return { ...answer, conversationId };
}
