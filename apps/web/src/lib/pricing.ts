import type { AppConfig } from "./config";
import { getConfig } from "./config";
import { supabase } from "./db";

// Preço sugerido para ajuda aberta (pitch: "R$ 40 nunca não compensa").
// A sugestão só preenche o valor inicial; o cliente continua livre para mudar.

export const MIN_ORDER_SAMPLES = 5;
const HISTORY_DAYS = 90;
/** Brasília não tem horário de verão desde 2019: UTC−3 fixo. */
const BRT_OFFSET_HOURS = -3;

export type PriceSource = "category_history" | "category_catalog" | "global_history" | "default";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function roundToFiveReais(cents: number): number {
  return Math.max(500, Math.round(cents / 500) * 500);
}

export function isOffHours(
  now: Date,
  config: Pick<AppConfig, "businessHoursStart" | "businessHoursEnd">,
): boolean {
  const hour = (now.getUTCHours() + 24 + BRT_OFFSET_HOURS) % 24;
  return hour < config.businessHoursStart || hour >= config.businessHoursEnd;
}

export function suggestPrice(
  samples: { categoryOrders: number[]; categoryCatalog: number[]; globalOrders: number[] },
  config: Pick<
    AppConfig,
    "suggestedPriceFallbackCents" | "offHoursPriceMultiplier" | "businessHoursStart" | "businessHoursEnd"
  >,
  now: Date,
): { priceCents: number; source: PriceSource; offHours: boolean } {
  let base: number | null = null;
  let source: PriceSource = "default";
  if (samples.categoryOrders.length >= MIN_ORDER_SAMPLES) {
    base = median(samples.categoryOrders);
    source = "category_history";
  } else if (samples.categoryCatalog.length > 0) {
    base = median(samples.categoryCatalog);
    source = "category_catalog";
  } else if (samples.globalOrders.length >= MIN_ORDER_SAMPLES) {
    base = median(samples.globalOrders);
    source = "global_history";
  }
  const offHours = isOffHours(now, config);
  const raw = (base ?? config.suggestedPriceFallbackCents) * (offHours ? config.offHoursPriceMultiplier : 1);
  return { priceCents: roundToFiveReais(raw), source, offHours };
}

export async function suggestedPriceFor(categoryId: string | null, now = new Date()) {
  const config = await getConfig();
  const since = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60_000).toISOString();

  const completed = supabase
    .from("order")
    .select("priceCents, categoryId")
    .eq("isOpenRequest", true)
    .eq("status", "COMPLETED")
    .gte("createdAt", since)
    .limit(1000);
  const [{ data: orders }, { data: catalog }] = await Promise.all([
    completed,
    categoryId
      ? supabase.from("service").select("priceCents").eq("categoryId", categoryId).limit(1000)
      : Promise.resolve({ data: [] as { priceCents: number }[] }),
  ]);

  const all = (orders ?? []).filter((o) => o.priceCents > 0);
  return suggestPrice(
    {
      categoryOrders: categoryId ? all.filter((o) => o.categoryId === categoryId).map((o) => o.priceCents) : [],
      categoryCatalog: (catalog ?? []).map((s) => s.priceCents),
      globalOrders: all.map((o) => o.priceCents),
    },
    config,
    now,
  );
}
