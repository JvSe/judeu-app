import { ensureUtcIso } from "./dates";
import { supabase } from "./db";

// Reverificação de quem atende: selfie nova antes de começar (aleatória) ou
// depois de trocar de aparelho. Bloqueia com HTTP 428 até a selfie chegar.

export const REVERIFY_STATUS = 428;
export const REVERIFY_MESSAGES = {
  random: "Antes de começar, tire uma selfie rápida para confirmar que é você.",
  device: "Você entrou por um aparelho novo. Tire uma selfie para confirmar que é você.",
  pending: "Tire uma selfie para confirmar que é você antes de continuar.",
} as const;

export type ReverifyProfile = {
  reverifyRequiredAt?: string | null;
  lastSelfieAt?: string | null;
};

/** Decide se o start_work precisa de selfie agora. `roll` em [0,1) (Math.random em produção). */
export function reverifyDecision(
  p: ReverifyProfile,
  config: { reverifyProbability: number; reverifyFreshMin: number },
  roll: number,
  now = new Date(),
): "pending" | "fresh" | "required" | "skip" {
  if (p.reverifyRequiredAt) return "pending";
  if (p.lastSelfieAt) {
    const age = now.getTime() - new Date(ensureUtcIso(p.lastSelfieAt)).getTime();
    if (age <= config.reverifyFreshMin * 60_000) return "fresh";
  }
  return roll < config.reverifyProbability ? "required" : "skip";
}

export async function requireReverification(providerId: string, reason: string): Promise<void> {
  await supabase
    .from("providerprofile")
    .update({ reverifyRequiredAt: new Date().toISOString(), reverifyReason: reason, isAvailable: false })
    .eq("id", providerId);
}
