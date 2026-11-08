// Regra de cobrança da plataforma. Cada pedido guarda a regra com que nasceu
// (Order.feeRate / Order.feePayer), então mudar a configuração nunca altera um
// pedido em andamento nem os antigos (que ficam com 8% pagos pelo cliente).

export type FeePayer = "CLIENT" | "PROVIDER";

export type FeeRule = { rate: number; payer: FeePayer };

/** Regra dos pedidos criados antes da migração 008 (padrão das colunas novas). */
export const LEGACY_FEE_RULE: FeeRule = { rate: 0.08, payer: "CLIENT" };

export type FeeBreakdown = {
  /** Parte da plataforma (antes do desconto, que ela mesma absorve). */
  platformFeeCents: number;
  /** O que o cliente paga (já com o desconto). */
  totalCents: number;
  /** O que quem atende recebe — o desconto não mexe nisso. */
  providerNetCents: number;
  /** Desconto aplicado de fato (cupom + crédito), depois do teto. */
  discountCents: number;
};

/** O desconto nunca deixa o total abaixo disto (mínimo de cobrança no cartão). */
export const MIN_TOTAL_AFTER_DISCOUNT_CENTS = 100;

/** Teto do desconto para um total bruto. */
export function maxDiscountFor(grossTotalCents: number): number {
  return Math.max(0, grossTotalCents - MIN_TOTAL_AFTER_DISCOUNT_CENTS);
}

/**
 * CLIENT: a taxa é somada ao preço (cliente paga preço + taxa; quem atende recebe o preço).
 * PROVIDER: a taxa sai do preço (cliente paga o preço; quem atende recebe preço − taxa).
 */
export function computeFees(priceCents: number, rule: FeeRule, discountCents = 0): FeeBreakdown {
  const platformFeeCents = Math.round(priceCents * rule.rate);
  const gross =
    rule.payer === "PROVIDER"
      ? { totalCents: priceCents, providerNetCents: priceCents - platformFeeCents }
      : { totalCents: priceCents + platformFeeCents, providerNetCents: priceCents };
  const applied = Math.min(Math.max(0, Math.round(discountCents)), maxDiscountFor(gross.totalCents));
  return {
    platformFeeCents,
    totalCents: gross.totalCents - applied,
    providerNetCents: gross.providerNetCents,
    discountCents: applied,
  };
}

/** Regra para um pedido novo: taxa da categoria (se houver) ou a da configuração. */
export function resolveFeeRule(
  config: { platformFeeRate: number; feePayer: FeePayer },
  category?: { feeRate: number | null } | null,
): FeeRule {
  return { rate: category?.feeRate ?? config.platformFeeRate, payer: config.feePayer };
}

/** Regra gravada num pedido; linhas sem as colunas (banco antigo) caem na regra legada. */
export function feeRuleOf(order: { feeRate?: number | null; feePayer?: string | null }): FeeRule {
  return {
    rate: order.feeRate ?? LEGACY_FEE_RULE.rate,
    payer: order.feePayer === "PROVIDER" ? "PROVIDER" : LEGACY_FEE_RULE.payer,
  };
}

export type WalletMovement =
  | { type: "CREDIT" | "DEBIT"; amountCents: number; description: string }
  | null;

/**
 * Movimento na carteira de quem atende quando o pedido é concluído.
 * - Regra legada (CLIENT): igual ao comportamento antigo — credita o preço
 *   se pago pelo app ou em dinheiro.
 * - PROVIDER, pago pelo app: credita preço − taxa.
 * - PROVIDER, em dinheiro: quem atende já recebeu tudo em mãos; a taxa vira
 *   dívida (DEBIT) na carteira.
 */
export function completionWalletMovement(
  rule: FeeRule,
  order: { priceCents: number; platformFeeCents: number; totalCents?: number; discountCents?: number | null },
  payment: { method: string; paid: boolean } | null,
): WalletMovement {
  if (!payment) return null;
  const isCash = payment.method === "CASH";
  if (!isCash && !payment.paid) return null;

  // Com desconto em dinheiro: quem atende recebeu só o total (já descontado) em
  // mãos. A carteira acerta a diferença até o líquido dele (o desconto é da plataforma).
  const discount = order.discountCents ?? 0;
  if (discount > 0 && isCash && order.totalCents != null) {
    const net = computeFees(order.priceCents, rule).providerNetCents;
    const diff = net - order.totalCents;
    if (diff > 0) return { type: "CREDIT", amountCents: diff, description: "Reembolso do desconto dado ao cliente" };
    if (diff < 0) {
      return { type: "DEBIT", amountCents: -diff, description: "Taxa da plataforma (pedido recebido em dinheiro)" };
    }
    return null;
  }

  if (rule.payer === "CLIENT") {
    return order.priceCents > 0
      ? { type: "CREDIT", amountCents: order.priceCents, description: "Repasse de pedido concluído" }
      : null;
  }
  if (isCash) {
    return order.platformFeeCents > 0
      ? {
          type: "DEBIT",
          amountCents: order.platformFeeCents,
          description: "Taxa da plataforma (pedido recebido em dinheiro)",
        }
      : null;
  }
  const net = order.priceCents - order.platformFeeCents;
  return net > 0
    ? { type: "CREDIT", amountCents: net, description: "Repasse de pedido concluído (já descontada a taxa)" }
    : null;
}
