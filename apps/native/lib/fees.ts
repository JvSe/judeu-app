// Mesma conta de apps/web/src/lib/fees.ts, para a prévia antes de criar o pedido.
// Depois de criado, vale o que a API gravou no pedido (platformFeeCents/totalCents).
import type { AppConfig } from "@/lib/api";

export function previewOrderTotals(
  priceCents: number,
  config: Pick<AppConfig, "platformFeeRate" | "feePayer">,
): { platformFeeCents: number; totalCents: number; providerNetCents: number } {
  const platformFeeCents = Math.round(priceCents * config.platformFeeRate);
  return config.feePayer === "PROVIDER"
    ? { platformFeeCents, totalCents: priceCents, providerNetCents: priceCents - platformFeeCents }
    : { platformFeeCents, totalCents: priceCents + platformFeeCents, providerNetCents: priceCents };
}

/** "20%" a partir de 0.2. */
export function percentLabel(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`.replace(".", ",");
}
