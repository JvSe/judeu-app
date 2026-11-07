import { randomUUID } from "node:crypto";

import type { ReportRow } from "@judeu/db";
import { env } from "@judeu/env/server";

import { revokeAllRefreshTokens } from "./auth";
import { getConfig } from "./config";
import { supabase } from "./db";
import { sendEmail } from "./mailer";
import { notifyUser } from "./notifications";

// Moderação: denúncia, suspensão de conta (cliente ou quem atende) e bloqueio
// automático por nota baixa.

export const REPORT_REASONS = ["SAFETY", "BEHAVIOR", "FRAUD", "NO_SHOW", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  SAFETY: "Me senti em risco",
  BEHAVIOR: "Comportamento inadequado",
  FRAUD: "Golpe ou cobrança indevida",
  NO_SHOW: "Não apareceu",
  OTHER: "Outro motivo",
};

/** Média baixa com avaliações suficientes → suspender. */
export function shouldAutoBlock(
  ratings: number[],
  config: { autoBlockMinReviews: number; autoBlockMaxAvg: number },
): boolean {
  if (ratings.length < config.autoBlockMinReviews) return false;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return avg < config.autoBlockMaxAvg;
}

/** Prazo do suporte: segurança e disputa são urgentes. */
export function slaDueAt(
  category: string,
  createdAt: Date,
  config: { supportUrgentSlaMin: number; supportSlaMin: number },
): string {
  const urgent = category === "SECURITY" || category === "DISPUTE";
  const minutes = urgent ? config.supportUrgentSlaMin : config.supportSlaMin;
  return new Date(createdAt.getTime() + minutes * 60_000).toISOString();
}

export async function setUserBlocked(userId: string, blocked: boolean, reason: string | null): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("user")
    .update({ blockedAt: blocked ? now : null, blockedReason: blocked ? reason : null, updatedAt: now })
    .eq("id", userId);
  if (blocked) {
    await revokeAllRefreshTokens(userId);
    await supabase.from("providerprofile").update({ isAvailable: false, updatedAt: now }).eq("userId", userId);
  }
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const { data } = await supabase.from("user").select("blockedAt").eq("id", userId).maybeSingle();
  return !!data?.blockedAt;
}

/**
 * Depois de uma avaliação: se a pessoa avaliada tem média baixa com avaliações
 * suficientes, suspende (quem atende vira BLOCKED; cliente ganha blockedAt).
 */
export async function autoBlockIfNeeded(targetUserId: string): Promise<boolean> {
  const config = await getConfig();
  const { data } = await supabase.from("review").select("rating").eq("targetId", targetUserId);
  const ratings = (data ?? []).map((r) => r.rating);
  if (!shouldAutoBlock(ratings, config)) return false;

  const reason = "Bloqueio automático: média de avaliações baixa";
  const { data: profile } = await supabase
    .from("providerprofile")
    .select("id, status")
    .eq("userId", targetUserId)
    .maybeSingle();
  if (profile && profile.status !== "BLOCKED") {
    await supabase
      .from("providerprofile")
      .update({ status: "BLOCKED", isAvailable: false, updatedAt: new Date().toISOString() })
      .eq("id", profile.id);
  } else if (!profile) {
    await setUserBlocked(targetUserId, true, reason);
  } else {
    return false;
  }
  void notifyUser(targetUserId, "SUPPORT", {
    title: "Conta em revisão",
    body: "Sua conta foi suspensa por avaliações baixas. Fale com o suporte para entender e pedir revisão.",
    data: { type: "provider_status" },
  });
  return true;
}

export async function createReport(
  orderId: string,
  reporterId: string,
  input: { reason: ReportReason; details?: string },
): Promise<{ id: string } | { error: string; status: number }> {
  const { data } = await supabase
    .from("order")
    .select("clientId, provider:providerprofile(userId)")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as unknown as {
    clientId: string;
    provider: { userId: string } | { userId: string }[] | null;
  } | null;
  const provider = Array.isArray(order?.provider) ? order?.provider[0] : order?.provider;
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  const reported =
    order.clientId === reporterId ? provider?.userId : provider?.userId === reporterId ? order.clientId : null;
  if (!reported) return { error: "Pedido não encontrado", status: 404 };

  const id = randomUUID();
  const { error } = await supabase.from("report").insert({
    id,
    reporterId,
    reportedUserId: reported,
    orderId,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: "Você já denunciou este pedido", status: 409 };
    throw new Error(error.message);
  }
  if (input.reason === "SAFETY" && env.SECURITY_ALERT_EMAIL) {
    void sendEmail({
      to: env.SECURITY_ALERT_EMAIL,
      subject: "[Ajuda+] Denúncia de segurança",
      body: `Pedido ${orderId}: ${input.details?.trim() || "(sem detalhes)"}`,
    }).catch(() => undefined);
  }
  return { id };
}

export type AdminReportDTO = ReportRow & { reporterName: string; reportedName: string; reportedBlocked: boolean };

export async function listReports(): Promise<AdminReportDTO[]> {
  const { data } = await supabase
    .from("report")
    .select(
      "*, reporter:user!report_reporterId_fkey(fullName), reported:user!report_reportedUserId_fkey(fullName, blockedAt)",
    )
    .order("status")
    .order("createdAt", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as (ReportRow & {
    reporter: { fullName: string };
    reported: { fullName: string; blockedAt: string | null };
  })[]).map(({ reporter, reported, ...r }) => ({
    ...r,
    reporterName: reporter.fullName,
    reportedName: reported.fullName,
    reportedBlocked: !!reported.blockedAt,
  }));
}

export async function markReportReviewed(id: string): Promise<void> {
  await supabase.from("report").update({ status: "REVIEWED" }).eq("id", id);
}
