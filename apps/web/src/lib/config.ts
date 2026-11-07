import { z } from "zod";

import type { Json } from "@judeu/db";

import { supabase } from "./db";

// Parâmetros de negócio editáveis sem deploy. Os padrões reproduzem o
// comportamento atual; uma linha na tabela `appconfig` sobrescreve só a chave dela.
export const configSchema = z.object({
  /** Fração cobrada pela plataforma sobre o preço do serviço (pedidos novos). */
  platformFeeRate: z.number().min(0).max(1).default(0.2),
  /** Quem paga a taxa: CLIENT = somada ao total; PROVIDER = descontada do repasse. */
  feePayer: z.enum(["CLIENT", "PROVIDER"]).default("PROVIDER"),
  /**
   * Em pedido em dinheiro, quem atende recebe tudo em mãos e a taxa vira dívida
   * na carteira. Acima deste valor devido, não pode ficar disponível.
   */
  cashDebtLimitCents: z.number().int().min(0).default(5000),
  /** Duração prevista de um serviço quando a categoria não define (minutos). */
  defaultExpectedDurationMin: z.number().int().min(10).default(120),
  /** Alerta de tempo excedido quando passa desta fração da duração prevista. */
  overtimeAlertRatio: z.number().min(1).max(5).default(1.5),
  /** Posição de quem atende mais velha que isto não serve para a geocerca. */
  locationFreshMs: z.number().int().positive().default(5 * 60_000),
  /** LGPD: dias até apagar posições de pedidos encerrados e de quem está parado. */
  locationRetentionDays: z.number().int().min(1).default(30),
  /** LGPD: dias até apagar o KYC de cadastros bloqueados. */
  blockedKycRetentionDays: z.number().int().min(1).default(180),
  /** Menor saque permitido. */
  payoutMinCents: z.number().int().min(100).default(1000),
  /** Tarifa por saque (cobrada do valor sacado). */
  payoutFeeCents: z.number().int().min(0).default(0),
  /** Preço sugerido quando ainda não há histórico nem catálogo. */
  suggestedPriceFallbackCents: z.number().int().min(100).default(4000),
  /** Multiplicador da sugestão fora do horário comercial (Brasília). */
  offHoursPriceMultiplier: z.number().min(1).max(3).default(1.2),
  /** Horário comercial (hora local de Brasília), [início, fim). */
  businessHoursStart: z.number().int().min(0).max(23).default(8),
  businessHoursEnd: z.number().int().min(1).max(24).default(20),
  /** Tempo de uma ajuda aberta no ar antes de expirar. */
  openRequestTtlMs: z.number().int().positive().default(4 * 60 * 60 * 1000),
  /** Tempo para o prestador responder a uma chamada direta. */
  offerTtlMs: z.number().int().positive().default(60_000),
  /**
   * Chamada direta sem resposta depois disto é cancelada pelo cron (o cliente
   * já pode trocar de pessoa após offerTtlMs; aqui só limpamos o abandonado).
   */
  directOfferAbandonMs: z.number().int().positive().default(30 * 60_000),
});

export type AppConfig = z.infer<typeof configSchema>;
export type ConfigKey = keyof AppConfig;

export const DEFAULT_CONFIG: AppConfig = configSchema.parse({});

/** Chaves que o app pode ler sem autenticação (`GET /api/config`). */
export const PUBLIC_CONFIG_KEYS = [
  "platformFeeRate",
  "feePayer",
  "openRequestTtlMs",
  "offerTtlMs",
] as const satisfies readonly ConfigKey[];

export type PublicConfig = Pick<AppConfig, (typeof PUBLIC_CONFIG_KEYS)[number]>;

/**
 * Aplica as linhas do banco sobre os padrões. Chave desconhecida é ignorada e
 * valor inválido cai no padrão daquela chave — uma linha errada nunca derruba a API.
 */
export function mergeConfig(rows: { key: string; value: Json }[]): AppConfig {
  const merged: AppConfig = { ...DEFAULT_CONFIG };
  const shape = configSchema.shape;
  for (const row of rows) {
    if (!(row.key in shape)) continue;
    const key = row.key as ConfigKey;
    const parsed = shape[key].safeParse(row.value);
    if (parsed.success) {
      (merged as Record<ConfigKey, unknown>)[key] = parsed.data;
    } else {
      console.warn(`[config] valor inválido para "${key}", usando o padrão`);
    }
  }
  return merged;
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return Object.fromEntries(PUBLIC_CONFIG_KEYS.map((k) => [k, config[k]])) as PublicConfig;
}

const CACHE_TTL_MS = 60_000;
let cache: { value: AppConfig; at: number } | null = null;

/** Configuração atual, com cache de 60 s. Se o banco falhar, usa os padrões. */
export async function getConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const { data, error } = await supabase.from("appconfig").select("key, value");
  if (error) {
    console.warn("[config] falha ao ler appconfig, usando padrões:", error.message);
    return cache?.value ?? DEFAULT_CONFIG;
  }
  const value = mergeConfig(data ?? []);
  cache = { value, at: Date.now() };
  return value;
}

/** Só para testes. */
export function resetConfigCache() {
  cache = null;
}
