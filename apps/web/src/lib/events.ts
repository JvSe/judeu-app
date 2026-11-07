import { randomUUID } from "node:crypto";

import type { AppEventRow, Json } from "@judeu/db";

import { supabase } from "./db";

// Tipos de evento conhecidos. Novos tipos entram aqui para manter as consultas
// de métricas (Fase 2) previsíveis.
export const APP_EVENT_TYPES = [
  "search.performed",
  "search.no_results",
  "geocode.failed",
  "nearby.viewed",
  "order.eta_measured",
] as const;

export type AppEventType = (typeof APP_EVENT_TYPES)[number];

export type TrackEventInput = {
  type: AppEventType;
  userId?: string | null;
  orderId?: string | null;
  props?: Record<string, Json>;
};

export function buildAppEvent(input: TrackEventInput, now = new Date()): AppEventRow {
  return {
    id: randomUUID(),
    type: input.type,
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
    props: input.props ?? {},
    createdAt: now.toISOString(),
  };
}

/**
 * Registra um evento de produto. Nunca lança erro nem atrasa o fluxo de quem
 * chama: use `void trackEvent(...)`. Uma falha vira só um aviso no log.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const { error } = await supabase.from("appevent").insert(buildAppEvent(input));
    if (error) console.warn(`[events] falha ao gravar "${input.type}":`, error.message);
  } catch (err) {
    console.warn(`[events] falha ao gravar "${input.type}":`, err);
  }
}
