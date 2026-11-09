import type { Json } from "@judeu/db";

import { type AppConfig, getConfig } from "../config";
import { ensureUtcIso } from "../dates";
import { supabase } from "../db";
import { notifyUser } from "../notifications";
import { releaseOrderDiscounts } from "../discounts";
import { refundIfPaid } from "../payments";
import type { CronJob } from "./runner";

export type ExpiryCandidate = {
  id: string;
  isOpenRequest: boolean;
  providerId: string | null;
  createdAt: string;
  scheduledAt: string | null;
};

export type ExpiryReason = "OPEN_REQUEST_EXPIRED" | "DIRECT_OFFER_ABANDONED";

export const EXPIRY_NOTES: Record<ExpiryReason, string> = {
  OPEN_REQUEST_EXPIRED: "Expirou sem ninguém aceitar",
  DIRECT_OFFER_ABANDONED: "Expirou sem resposta de quem foi chamado",
};

/**
 * Decide se um pedido CREATED deve expirar agora. O relógio começa no maior
 * entre a criação e o horário agendado (pedido agendado não expira antes da hora).
 */
export function expiryDecision(
  order: ExpiryCandidate,
  config: Pick<AppConfig, "openRequestTtlMs" | "directOfferAbandonMs">,
  now: Date,
): ExpiryReason | null {
  const created = new Date(ensureUtcIso(order.createdAt)).getTime();
  const scheduled = order.scheduledAt ? new Date(ensureUtcIso(order.scheduledAt)).getTime() : 0;
  const start = Math.max(created, scheduled);
  const age = now.getTime() - start;

  if (order.isOpenRequest && !order.providerId) {
    return age > config.openRequestTtlMs ? "OPEN_REQUEST_EXPIRED" : null;
  }
  if (order.providerId) {
    return age > config.directOfferAbandonMs ? "DIRECT_OFFER_ABANDONED" : null;
  }
  return null;
}

async function expireOne(
  order: ExpiryCandidate & { clientId: string; providerUserId: string | null },
  reason: ExpiryReason,
  now: Date,
): Promise<boolean> {
  const note = EXPIRY_NOTES[reason];
  // Só cancela se ainda estiver CREATED (alguém pode ter aceitado no meio).
  const { data: still } = await supabase
    .from("order")
    .select("status")
    .eq("id", order.id)
    .maybeSingle();
  if (still?.status !== "CREATED") return false;

  const { error } = await supabase.rpc("transition_order", {
    p_order_id: order.id,
    p_status: "CANCELLED",
    p_patch: { cancelledAt: now.toISOString(), cancelReason: note } as Json,
    p_event_note: note,
  });
  if (error) throw new Error(`expirar ${order.id}: ${error.message}`);

  await releaseOrderDiscounts(order.id).catch((err) =>
    console.error(`[cron] devolução de cupom/crédito do pedido ${order.id} falhou:`, err),
  );
  await refundIfPaid(order.id).catch((err) =>
    console.error(`[cron] estorno do pedido ${order.id} falhou:`, err),
  );

  void notifyUser(order.clientId, "ORDER", {
    title: reason === "OPEN_REQUEST_EXPIRED" ? "Seu pedido expirou" : "Chamada sem resposta",
    body:
      reason === "OPEN_REQUEST_EXPIRED"
        ? "Ninguém aceitou a tempo. Você pode publicar de novo, talvez com outro valor."
        : "A pessoa não respondeu e a chamada foi encerrada. Tente chamar outra pessoa.",
    data: { type: "order", orderId: order.id, role: "client" },
  });
  if (order.providerUserId) {
    void notifyUser(order.providerUserId, "ORDER", {
      title: "Chamada encerrada",
      body: "A chamada expirou sem resposta.",
      data: { type: "order", orderId: order.id, role: "provider" },
    });
  }
  return true;
}

export const expireOrdersJob: CronJob = {
  name: "expireOrders",
  async run(now) {
    const config = await getConfig();
    const { data, error } = await supabase
      .from("order")
      .select("id, clientId, isOpenRequest, providerId, createdAt, scheduledAt, provider:providerprofile(userId)")
      .eq("status", "CREATED")
      .order("createdAt", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    let openExpired = 0;
    let directExpired = 0;
    for (const raw of data ?? []) {
      const row = raw as unknown as ExpiryCandidate & {
        clientId: string;
        provider: { userId: string } | { userId: string }[] | null;
      };
      const reason = expiryDecision(row, config, now);
      if (!reason) continue;
      const provider = Array.isArray(row.provider) ? row.provider[0] : row.provider;
      const done = await expireOne({ ...row, providerUserId: provider?.userId ?? null }, reason, now);
      if (!done) continue;
      if (reason === "OPEN_REQUEST_EXPIRED") openExpired += 1;
      else directExpired += 1;
    }
    return { openExpired, directExpired };
  },
};
