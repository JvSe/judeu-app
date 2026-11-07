import { randomUUID } from "node:crypto";

import type { PayoutAccountRow, PayoutRow } from "@judeu/db";
import { env } from "@judeu/env/server";

import { getConfig } from "./config";
import { supabase } from "./db";
import { notifyUser } from "./notifications";

// Saque de quem atende. Hoje só existe o provedor "simulated": o saque é
// registrado e debitado da carteira, com comprovante, mas nenhum dinheiro é
// transferido. Para ligar um provedor real (Stripe Connect, Pagar.me, Asaas…),
// implemente PayoutProvider e registre em PROVIDERS — o resto do fluxo
// (prévia, retenção por disputa, débito atômico, extrato) não muda.

// ---------------------------------------------------------------------------
// Chave Pix
// ---------------------------------------------------------------------------

export type PixKeyType = PayoutAccountRow["pixKeyType"];

const digits = (s: string) => s.replace(/\D/g, "");

function validCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(cnpj[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/** Normaliza e valida a chave Pix. Devolve a chave normalizada ou uma mensagem de erro. */
export function normalizePixKey(type: PixKeyType, raw: string): { key: string } | { error: string } {
  const value = raw.trim();
  switch (type) {
    case "CPF": {
      const d = digits(value);
      return validCpf(d) ? { key: d } : { error: "CPF inválido" };
    }
    case "CNPJ": {
      const d = digits(value);
      return validCnpj(d) ? { key: d } : { error: "CNPJ inválido" };
    }
    case "EMAIL":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 77
        ? { key: value.toLowerCase() }
        : { error: "E-mail inválido" };
    case "PHONE": {
      let d = digits(value);
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      return /^\d{10,11}$/.test(d) ? { key: `+55${d}` } : { error: "Celular inválido (com DDD)" };
    }
    case "RANDOM":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
        ? { key: value.toLowerCase() }
        : { error: "Chave aleatória inválida" };
  }
}

/** Chave mascarada para telas e comprovante (nunca devolvemos a chave inteira). */
export function maskPixKey(type: PixKeyType, key: string): string {
  switch (type) {
    case "CPF":
      return `***.${key.slice(3, 6)}.${key.slice(6, 9)}-**`;
    case "CNPJ":
      return `**.${key.slice(2, 5)}.${key.slice(5, 8)}/****-**`;
    case "EMAIL": {
      const [user, domain] = key.split("@");
      return `${user.slice(0, 2)}***@${domain}`;
    }
    case "PHONE":
      return `(${key.slice(3, 5)}) *****-${key.slice(-4)}`;
    case "RANDOM":
      return `${key.slice(0, 4)}…${key.slice(-4)}`;
  }
}

// ---------------------------------------------------------------------------
// Prévia ("como fica depois do saque")
// ---------------------------------------------------------------------------

export type PayoutPreview = {
  balanceCents: number;
  /** Retido por disputa aberta — não pode ser sacado ainda. */
  heldCents: number;
  availableCents: number;
  amountCents: number;
  feeCents: number;
  /** O que cai na conta. */
  netCents: number;
  balanceAfterCents: number;
  minCents: number;
  /** Por que não dá para sacar este valor (null = pode). */
  error: string | null;
};

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function buildPayoutPreview(input: {
  balanceCents: number;
  heldCents: number;
  amountCents: number;
  minCents: number;
  feeCents: number;
}): PayoutPreview {
  const heldCents = Math.min(Math.max(input.heldCents, 0), Math.max(input.balanceCents, 0));
  const availableCents = Math.max(input.balanceCents - heldCents, 0);
  const amountCents = Math.max(Math.round(input.amountCents), 0);
  const feeCents = Math.min(input.feeCents, amountCents);
  let error: string | null = null;
  if (input.balanceCents < 0) error = "Você tem taxas a acertar; o saque fica liberado depois.";
  else if (amountCents < input.minCents) error = `O saque mínimo é ${brl(input.minCents)}.`;
  else if (amountCents > availableCents) error = `Você pode sacar até ${brl(availableCents)}.`;
  else if (amountCents - feeCents <= 0) error = "O valor não cobre a tarifa do saque.";
  return {
    balanceCents: input.balanceCents,
    heldCents,
    availableCents,
    amountCents,
    feeCents,
    netCents: amountCents - feeCents,
    balanceAfterCents: input.balanceCents - amountCents,
    minCents: input.minCents,
    error,
  };
}

/**
 * Valor retido: créditos de pedidos com disputa aberta (chamado DISPUTE não
 * resolvido). O repasse espera a resolução.
 */
async function heldByDisputes(walletId: string): Promise<number> {
  const { data: disputes } = await supabase
    .from("supportticket")
    .select("orderId")
    .eq("category", "DISPUTE")
    .neq("status", "RESOLVED")
    .not("orderId", "is", null);
  const orderIds = [...new Set((disputes ?? []).map((d) => d.orderId).filter((id): id is string => !!id))];
  if (orderIds.length === 0) return 0;
  const { data: credits } = await supabase
    .from("wallettransaction")
    .select("amountCents")
    .eq("walletId", walletId)
    .eq("type", "CREDIT")
    .in("orderId", orderIds);
  return (credits ?? []).reduce((s, c) => s + c.amountCents, 0);
}

async function loadState(userId: string) {
  const [{ data: wallet }, { data: account }, config] = await Promise.all([
    supabase.from("wallet").select("*").eq("userId", userId).maybeSingle(),
    supabase.from("payoutaccount").select("*").eq("userId", userId).maybeSingle(),
    getConfig(),
  ]);
  const heldCents = wallet ? await heldByDisputes(wallet.id) : 0;
  return { wallet, account, config, heldCents };
}

// ---------------------------------------------------------------------------
// Provedor
// ---------------------------------------------------------------------------

export type PayoutProvider = {
  name: string;
  /** Rótulo do status mostrado no comprovante. */
  send(input: {
    payoutId: string;
    netCents: number;
    pixKeyType: PixKeyType;
    pixKey: string;
    holderName: string;
  }): Promise<{ status: PayoutRow["status"]; providerRef: string | null }>;
};

const simulatedProvider: PayoutProvider = {
  name: "simulated",
  async send({ payoutId }) {
    return { status: "SIMULATED", providerRef: `SIM-${payoutId.slice(0, 8).toUpperCase()}` };
  },
};

const PROVIDERS: Record<string, PayoutProvider> = { simulated: simulatedProvider };

function payoutProvider(): PayoutProvider {
  return PROVIDERS[env.PAYOUT_PROVIDER] ?? simulatedProvider;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export type PayoutAccountDTO = { pixKeyType: PixKeyType; pixKeyMasked: string; holderName: string };

export type PayoutDTO = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  status: PayoutRow["status"];
  simulated: boolean;
  providerRef: string | null;
  pixKeyMasked: string;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  createdAt: string;
};

const toPayoutDTO = (p: PayoutRow): PayoutDTO => ({
  id: p.id,
  amountCents: p.amountCents,
  feeCents: p.feeCents,
  netCents: p.netCents,
  status: p.status,
  simulated: p.status === "SIMULATED",
  providerRef: p.providerRef,
  pixKeyMasked: p.pixKeyMasked,
  balanceBeforeCents: p.balanceBeforeCents,
  balanceAfterCents: p.balanceAfterCents,
  createdAt: p.createdAt,
});

export async function getPayoutOverview(userId: string) {
  const { wallet, account, config, heldCents } = await loadState(userId);
  const balanceCents = wallet?.balanceCents ?? 0;
  const { data: payouts } = await supabase
    .from("payout")
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false })
    .limit(20);
  return {
    simulated: payoutProvider().name === "simulated",
    account: account
      ? { pixKeyType: account.pixKeyType, pixKeyMasked: maskPixKey(account.pixKeyType, account.pixKey), holderName: account.holderName }
      : null,
    preview: buildPayoutPreview({
      balanceCents,
      heldCents,
      amountCents: Math.max(balanceCents - heldCents, 0),
      minCents: config.payoutMinCents,
      feeCents: config.payoutFeeCents,
    }),
    payouts: (payouts ?? []).map(toPayoutDTO),
  };
}

export async function previewPayout(userId: string, amountCents: number): Promise<PayoutPreview> {
  const { wallet, config, heldCents } = await loadState(userId);
  return buildPayoutPreview({
    balanceCents: wallet?.balanceCents ?? 0,
    heldCents,
    amountCents,
    minCents: config.payoutMinCents,
    feeCents: config.payoutFeeCents,
  });
}

export async function savePayoutAccount(
  userId: string,
  input: { pixKeyType: PixKeyType; pixKey: string; holderName: string },
): Promise<PayoutAccountDTO | { error: string; status: number }> {
  const normalized = normalizePixKey(input.pixKeyType, input.pixKey);
  if ("error" in normalized) return { error: normalized.error, status: 422 };
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("payoutaccount").select("id").eq("userId", userId).maybeSingle();
  const row = {
    pixKeyType: input.pixKeyType,
    pixKey: normalized.key,
    holderName: input.holderName.trim(),
    updatedAt: now,
  };
  const { error } = existing
    ? await supabase.from("payoutaccount").update(row).eq("id", existing.id)
    : await supabase.from("payoutaccount").insert({ id: randomUUID(), userId, ...row, createdAt: now });
  if (error) throw new Error(error.message);
  return { pixKeyType: input.pixKeyType, pixKeyMasked: maskPixKey(input.pixKeyType, normalized.key), holderName: row.holderName };
}

const RPC_ERRORS: Record<string, string> = {
  PAYOUT_NO_BALANCE: "Você ainda não tem saldo para sacar.",
  PAYOUT_BELOW_MIN: "Valor abaixo do saque mínimo.",
  PAYOUT_INSUFFICIENT: "Saldo disponível insuficiente.",
};

export async function requestPayout(
  userId: string,
  amountCents: number,
): Promise<PayoutDTO | { error: string; status: number }> {
  const { wallet, account, config, heldCents } = await loadState(userId);
  if (!account) return { error: "Cadastre sua chave Pix antes de sacar.", status: 409 };
  const preview = buildPayoutPreview({
    balanceCents: wallet?.balanceCents ?? 0,
    heldCents,
    amountCents,
    minCents: config.payoutMinCents,
    feeCents: config.payoutFeeCents,
  });
  if (preview.error) return { error: preview.error, status: 409 };

  const provider = payoutProvider();
  const payoutId = randomUUID();
  // Simulado: nada sai daqui. Provedor real: a transferência seria iniciada aqui
  // e confirmada por webhook (status PROCESSING → PAID/FAILED).
  const sent = await provider.send({
    payoutId,
    netCents: preview.netCents,
    pixKeyType: account.pixKeyType,
    pixKey: account.pixKey,
    holderName: account.holderName,
  });
  const pixKeyMasked = maskPixKey(account.pixKeyType, account.pixKey);

  const { data, error } = await supabase.rpc("request_payout", {
    p_payout_id: payoutId,
    p_user_id: userId,
    p_amount_cents: preview.amountCents,
    p_fee_cents: preview.feeCents,
    p_held_cents: heldCents,
    p_min_cents: config.payoutMinCents,
    p_status: sent.status,
    p_provider: provider.name,
    p_provider_ref: sent.providerRef,
    p_pix_key_masked: pixKeyMasked,
    p_description:
      sent.status === "SIMULATED" ? `Saque Pix (simulação) para ${pixKeyMasked}` : `Saque Pix para ${pixKeyMasked}`,
  });
  if (error || !data) {
    const code = Object.keys(RPC_ERRORS).find((k) => error?.message.includes(k));
    if (code) return { error: RPC_ERRORS[code], status: 409 };
    throw new Error(error?.message ?? "Falha ao registrar o saque");
  }

  const payout = toPayoutDTO(data);
  void notifyUser(userId, "SUPPORT", {
    title: payout.simulated ? "Saque simulado registrado" : "Saque solicitado",
    body: `${brl(payout.netCents)} para ${pixKeyMasked}.${payout.simulated ? " Nenhum valor foi transferido (simulação)." : ""}`,
    data: { type: "payout", payoutId: payout.id },
  });
  return payout;
}
