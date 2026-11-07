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

/**
 * Nível final do pedido: o maior entre o da categoria e a sugestão da IA.
 * A sugestão vem do app (não é confiável), por isso só pode SUBIR o nível.
 */
export function effectiveRisk(categoryLevel: number | null | undefined, hint: number | null | undefined): RiskLevel {
  const base = normalizeRisk(categoryLevel);
  const suggested = hint == null ? 1 : normalizeRisk(hint);
  return (Math.max(base, suggested) as RiskLevel);
}

/** Rubrica usada nos prompts das duas IAs (no aparelho e na nuvem). */
export const RISK_RUBRIC = [
  "Nível de risco da tarefa (nivel_risco):",
  "1 = sem risco físico: recado, compra, fila, buscar/levar, companhia, carregar coisa leve, trocar lâmpada comum.",
  "2 = reparo simples com ferramenta: montar móvel, pendurar quadro/prateleira, trocar resistência de chuveiro desligado, desentupir pia.",
  "3 = exige profissional: mexer em fiação, tomada ou soquete, disjuntor, encanamento na parede, trabalho em altura (telhado, escada alta).",
  "4 = proibido no app: gás (botijão com vazamento, instalação), poda de árvore grande, qualquer coisa ilegal, cuidado médico ou de remédios.",
  "Na dúvida entre dois níveis, escolha o MAIOR.",
].join("\n");
