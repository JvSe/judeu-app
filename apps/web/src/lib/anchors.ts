import { computeFees, feeRuleOf } from "./fees";

// Âncoras com piso por hora (Fase 6). Regra:
// - o cron conta 1 minuto de presença a cada tick em que o âncora está
//   disponível (ou atendendo) dentro do turno;
// - piso = piso por hora × minutos presentes / 60;
// - ganho = o que recebeu (já sem a taxa) dos pedidos aceitos no turno e concluídos;
// - complemento = piso − ganho, se positivo. Vai para a carteira.

/** Intervalo mínimo entre duas contagens: o tick pode rodar duas vezes no mesmo minuto. */
export const PRESENCE_MIN_GAP_MS = 55_000;

export type ShiftWindow = { startsAt: string; endsAt: string; status: string };

export function isShiftActive(shift: ShiftWindow, now: Date): boolean {
  const t = now.getTime();
  return shift.status === "SCHEDULED" && new Date(shift.startsAt).getTime() <= t && t < new Date(shift.endsAt).getTime();
}

export function shouldCountPresence(lastPresenceAt: string | null, now: Date): boolean {
  return !lastPresenceAt || now.getTime() - new Date(lastPresenceAt).getTime() >= PRESENCE_MIN_GAP_MS;
}

/** Turno pronto para fechar a conta? */
export function isShiftDue(shift: ShiftWindow, now: Date, graceMin: number): boolean {
  return shift.status === "SCHEDULED" && new Date(shift.endsAt).getTime() + graceMin * 60_000 <= now.getTime();
}

export function shiftFloorCents(hourlyFloorCents: number, onlineMinutes: number): number {
  return Math.round((hourlyFloorCents * Math.max(0, onlineMinutes)) / 60);
}

export type ShiftOrder = {
  priceCents: number;
  feeRate?: number | null;
  feePayer?: string | null;
};

/** O que quem atende recebeu (sem a taxa) com os pedidos do turno. */
export function shiftEarningsCents(orders: ShiftOrder[]): number {
  return orders.reduce((sum, o) => sum + computeFees(o.priceCents, feeRuleOf(o)).providerNetCents, 0);
}

export function shiftSettlement(
  shift: { hourlyFloorCents: number; onlineMinutes: number },
  orders: ShiftOrder[],
): { floorCents: number; earnedCents: number; subsidyCents: number } {
  const floorCents = shiftFloorCents(shift.hourlyFloorCents, shift.onlineMinutes);
  const earnedCents = shiftEarningsCents(orders);
  return { floorCents, earnedCents, subsidyCents: Math.max(0, floorCents - earnedCents) };
}
