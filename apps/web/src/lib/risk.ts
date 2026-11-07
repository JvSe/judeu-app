import { ensureUtcIso } from "./dates";

// Níveis de tarefa (pitch, rodada 3): quanto maior o risco, mais qualificação.
export const RISK = { FREE: 1, SEAL: 2, PRO: 3, FORBIDDEN: 4 } as const;
export type RiskLevel = 1 | 2 | 3 | 4;

export type BadgeType = "REPAIRS_SEAL" | "PRO_CREDENTIAL";

export const RISK_LABEL: Record<RiskLevel, string> = {
  1: "Livre — qualquer pessoa aprovada",
  2: "Reparos simples — selo de reparos ou profissional",
  3: "Risco — só profissional com credencial",
  4: "Proibido no app",
};

export const BADGE_LABEL: Record<BadgeType, string> = {
  REPAIRS_SEAL: "Selo de reparos",
  PRO_CREDENTIAL: "Credencial profissional",
};

export function normalizeRisk(value: number | null | undefined): RiskLevel {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

export type QualifiedProvider = {
  isHelper: boolean;
  badges?: { type: string; expiresAt: string | null }[] | null;
};

function hasBadge(p: QualifiedProvider, type: BadgeType, now: Date): boolean {
  return (p.badges ?? []).some(
    (b) => b.type === type && (!b.expiresAt || new Date(ensureUtcIso(b.expiresAt)) > now),
  );
}

/** Quem atende pode pegar uma tarefa deste nível? */
export function canTakeRisk(p: QualifiedProvider, level: RiskLevel, now = new Date()): boolean {
  switch (level) {
    case 1:
      return true;
    case 2:
      return !p.isHelper || hasBadge(p, "REPAIRS_SEAL", now) || hasBadge(p, "PRO_CREDENTIAL", now);
    case 3:
      return !p.isHelper && hasBadge(p, "PRO_CREDENTIAL", now);
    default:
      return false;
  }
}

export const RISK_DENIED_MESSAGE: Record<Exclude<RiskLevel, 1>, string> = {
  2: "Esta tarefa exige o selo de reparos.",
  3: "Esta tarefa só pode ser feita por profissional com credencial.",
  4: "Este tipo de tarefa não pode ser pedido pelo app.",
};
