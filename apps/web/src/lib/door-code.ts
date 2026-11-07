import { randomInt, timingSafeEqual } from "node:crypto";

// "Código na porta": quem chega digita o código que o cliente vê no app.
// Confirma que é a pessoa certa antes de alguém entrar na casa.

export const DOOR_CODE_MAX_ATTEMPTS = 5;

export function generateDoorCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export type DoorCodeCheck = "ok" | "not_required" | "missing" | "wrong" | "locked";

export function checkDoorCode(
  order: { doorCode?: string | null; doorCodeAttempts?: number | null },
  input: string | undefined,
): DoorCodeCheck {
  if (!order.doorCode) return "not_required"; // pedido antigo, sem código
  if ((order.doorCodeAttempts ?? 0) >= DOOR_CODE_MAX_ATTEMPTS) return "locked";
  const typed = (input ?? "").replace(/\D/g, "");
  if (!typed) return "missing";
  const a = Buffer.from(typed);
  const b = Buffer.from(order.doorCode);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "wrong";
}

export const DOOR_CODE_MESSAGES: Record<Exclude<DoorCodeCheck, "ok" | "not_required">, string> = {
  missing: "Peça à pessoa o código de chegada que aparece no app dela.",
  wrong: "Código incorreto. Confira com a pessoa o código que aparece no app dela.",
  locked: "Muitas tentativas. Peça à pessoa para gerar um novo código no app.",
};
