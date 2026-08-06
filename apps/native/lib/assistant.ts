// Camada de IA on-device (React Native ExecuTorch 0.9.x).
//
// Arquitetura híbrida: o modelo Qwen3 roda no aparelho e conduz a conversa;
// quando entende o que o usuário precisa, chama a tool `buscar_prestadores`
// (function calling nativo do ExecuTorch). A tool NÃO é resolvida pelo modelo —
// ela executa uma consulta REAL no catálogo do Supabase (via API já existente) e
// devolve os prestadores de verdade. Assim honramos o RF-J4 ("não inventa prestadores")
// sem depender de chave de LLM no servidor.
//
// NOTA de versão: escrito contra a API 0.9.2 verificada nos .d.ts instalados
// (`initExecutorch({ resourceFetcher })`, `useLLM({ model })`, `configure({ chatConfig, toolsConfig })`,
// `LLMTool`/`ToolCall`, `QWEN3_1_7B_QUANTIZED`). Se atualizar a lib, reconferir estes nomes.
import { initExecutorch, isAvailable, QWEN3_1_7B_QUANTIZED } from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";

import type { Category } from "@/lib/api";

// Modelo padrão: Qwen3 1.7B quantizado — bom multilíngue (pt-BR) e suporta tool calling.
// Trocar por QWEN3_0_6B_QUANTIZED em aparelhos mais fracos, ou HAMMER2_1_1_5B_QUANTIZED
// se quiser priorizar precisão de function calling sobre conversa.
export const AI_MODEL = QWEN3_1_7B_QUANTIZED;

export const SEARCH_TOOL_NAME = "buscar_prestadores";

// Argumentos que o modelo preenche ao chamar a tool.
export type SearchArgs = { categoria: string; termo?: string };

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

// System prompt em pt-BR, com as categorias reais injetadas para o modelo
// mapear a fala do usuário para um slug válido da tool.
export function buildSystemPrompt(categories: Category[]): string {
  const lista = categories.length
    ? categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n")
    : "- reparos, limpeza, frete, beleza";
  return [
    "Você é o assistente do Ajuda+, um app de serviços locais sob demanda em Palmas, Tocantins.",
    "Seu objetivo é ajudar o usuário a encontrar um bom prestador de serviço.",
    "Fale em português do Brasil, de forma breve, amigável e direta.",
    "Faça no máximo uma ou duas perguntas curtas para entender o serviço e a urgência quando faltar contexto.",
    "Assim que identificar o tipo de serviço, chame a ferramenta buscar_prestadores com a categoria adequada.",
    "NUNCA invente prestadores, nomes, notas ou preços — use SEMPRE a ferramenta para trazer dados reais.",
    "Use SOMENTE as categorias da lista abaixo. Elas são tudo o que o Ajuda+ atende hoje.",
    "Se o que o usuário precisa não corresponder a nenhuma delas, NÃO chame a ferramenta: diga com franqueza que o Ajuda+ ainda não atende esse tipo de serviço e cite as categorias que existem.",
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
        "Busca prestadores de serviço reais cadastrados no Ajuda+, filtrando por categoria. " +
        "Chame sempre que o usuário indicar que precisa de um serviço. Não invente prestadores.",
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
export function parseToolCallArgs(raw: string): SearchArgs | null {
  type Call = { name?: string; arguments?: SearchArgs };
  const json =
    raw.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/)?.[1] ??
    raw.match(/\[\s*\{[\s\S]*?\}\s*\]/)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Call | Call[];
    const call = Array.isArray(parsed) ? parsed[0] : parsed;
    if (call?.name !== SEARCH_TOOL_NAME || !call.arguments) return null;
    return call.arguments;
  } catch {
    return null;
  }
}

// Resolve o slug que o modelo escolheu para o id de categoria real do backend.
// Tolera acentos/caixa e casa por slug ou por nome.
export function resolveCategoryId(categories: Category[], categoria: string): string | undefined {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const alvo = norm(categoria);
  const match =
    categories.find((c) => norm(c.slug) === alvo) ??
    categories.find((c) => norm(c.name) === alvo) ??
    categories.find((c) => norm(c.name).includes(alvo) || alvo.includes(norm(c.slug)));
  return match?.id;
}
