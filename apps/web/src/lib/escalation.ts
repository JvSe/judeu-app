import type { AppConfig } from "./config";
import { ensureUtcIso } from "./dates";

// Escalonamento da ajuda aberta sem aceite (Fase 6):
// nível 1 → avisa os âncoras de plantão (com raio ampliado);
// nível 2 → amplia o raio de todo mundo e avisa quem passou a alcançar o pedido.

export const ESCALATION = { NONE: 0, ANCHORS: 1, RADIUS: 2 } as const;
export type EscalationLevel = 0 | 1 | 2;

export type EscalationConfig = Pick<
  AppConfig,
  "escalateAnchorsAfterMin" | "escalateRadiusAfterMin" | "escalationRadiusMultiplier" | "escalateScheduledLeadMin"
>;

/** De quando conta o tempo sem aceite. Agendado: a partir de `lead` minutos antes do horário. */
export function escalationStartMs(
  order: { createdAt: string; scheduledAt: string | null },
  config: Pick<EscalationConfig, "escalateScheduledLeadMin">,
): number {
  const created = new Date(ensureUtcIso(order.createdAt)).getTime();
  if (!order.scheduledAt) return created;
  const scheduled = new Date(ensureUtcIso(order.scheduledAt)).getTime();
  return Math.max(created, scheduled - config.escalateScheduledLeadMin * 60_000);
}

/** Nível que o pedido deveria ter agora (nunca desce). */
export function escalationTarget(
  order: { createdAt: string; scheduledAt: string | null; escalationLevel?: number | null },
  config: EscalationConfig,
  now: Date,
): EscalationLevel {
  const current = (order.escalationLevel ?? 0) as EscalationLevel;
  const waitedMin = (now.getTime() - escalationStartMs(order, config)) / 60_000;
  let target: EscalationLevel = 0;
  if (config.escalateAnchorsAfterMin > 0 && waitedMin >= config.escalateAnchorsAfterMin) target = 1;
  if (config.escalateRadiusAfterMin > 0 && waitedMin >= config.escalateRadiusAfterMin) target = 2;
  return Math.max(current, target) as EscalationLevel;
}

/** Fator do raio de quem atende para um pedido neste nível. */
export function radiusScale(escalationLevel: number | null | undefined, multiplier: number): number {
  return (escalationLevel ?? 0) >= ESCALATION.RADIUS ? multiplier : 1;
}
