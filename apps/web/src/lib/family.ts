import { randomBytes } from "node:crypto";

import { env } from "@judeu/env/server";

import { ensureUtcIso } from "./dates";
import { supabase } from "./db";
import { routeBetween } from "./geo";
import { sendEmail } from "./mailer";

// Modo família: o filho acompanha quem foi, se chegou e quando saiu.
// - Contato de confiança no perfil do cliente (nome + e-mail).
// - Cada pedido novo de quem tem contato ganha um link público /t/<token>.
// - O contato recebe e-mail no aceite, na saída, na chegada e na conclusão.

export const SHARE_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export function newShareToken(): string {
  return randomBytes(16).toString("hex");
}

export function shareUrl(token: string): string {
  const base = (env.PUBLIC_WEB_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return `${base}/t/${token}`;
}

export type FamilyEvent = "accept" | "start_route" | "start_work" | "complete";

export function familyEmail(
  event: FamilyEvent,
  ctx: { clientFirstName: string; providerFirstName: string; task: string; link: string },
): { subject: string; body: string } {
  const { clientFirstName: c, providerFirstName: p, task, link } = ctx;
  const lines: Record<FamilyEvent, [string, string]> = {
    accept: [`${p} vai ajudar ${c}`, `${p} aceitou o pedido de ${c}: "${task}".`],
    start_route: [`${p} saiu para ajudar ${c}`, `${p} está a caminho de ${c}.`],
    start_work: [`${p} chegou na casa de ${c}`, `${p} chegou e confirmou o código de chegada com ${c}.`],
    complete: [`${p} terminou o atendimento de ${c}`, `${p} marcou o pedido de ${c} como concluído.`],
  };
  const [subject, first] = lines[event];
  return {
    subject,
    body: `${first}\n\nAcompanhe por aqui: ${link}\n\nVocê recebe estes avisos porque ${c} cadastrou você como contato de confiança no Ajuda+.`,
  };
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Alguém";

/** Avisa o contato de confiança do cliente. Nunca lança erro (não pode travar o pedido). */
export async function notifyTrustedContact(orderId: string, event: FamilyEvent): Promise<void> {
  try {
    const { data } = await supabase
      .from("order")
      .select(
        "shareToken, description, client:user!order_clientId_fkey(fullName, trustedContactEmail), provider:providerprofile(user:user!inner(fullName)), category:category(name), service:service(name)",
      )
      .eq("id", orderId)
      .maybeSingle();
    const row = data as unknown as {
      shareToken: string | null;
      description: string | null;
      client: { fullName: string; trustedContactEmail: string | null } | null;
      provider: { user: { fullName: string } } | null;
      category: { name: string } | null;
      service: { name: string } | null;
    } | null;
    const to = row?.client?.trustedContactEmail;
    if (!row?.shareToken || !to) return;
    const mail = familyEmail(event, {
      clientFirstName: firstName(row.client?.fullName),
      providerFirstName: firstName(row.provider?.user.fullName),
      task: row.service?.name ?? row.description ?? row.category?.name ?? "ajuda",
      link: shareUrl(row.shareToken),
    });
    await sendEmail({ to, ...mail });
  } catch (err) {
    console.warn("[family] aviso ao contato de confiança falhou:", err);
  }
}

// ---------------------------------------------------------------------------
// Página pública /t/<token>
// ---------------------------------------------------------------------------

export type SharedTrackingDTO = {
  status: string;
  statusLabel: string;
  clientFirstName: string;
  providerFirstName: string | null;
  providerAvatarUrl: string | null;
  task: string;
  etaMin: number | null;
  /** Só enquanto a pessoa está a caminho. */
  providerPosition: { lat: number; lng: number } | null;
  updatedAt: string | null;
  events: { label: string; at: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Procurando alguém para ajudar",
  ACCEPTED: "Pedido aceito",
  EN_ROUTE: "A caminho",
  IN_PROGRESS: "Chegou e está ajudando",
  AWAITING_CONFIRMATION: "Terminou — aguardando confirmação",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

/** O link vale enquanto o pedido está aberto e até 24 h depois de encerrado. */
export function isShareLinkActive(
  order: { status: string; completedAt: string | null; cancelledAt: string | null },
  now = new Date(),
): boolean {
  const ended = order.completedAt ?? order.cancelledAt;
  if (!ended) return true;
  return now.getTime() - new Date(ensureUtcIso(ended)).getTime() <= SHARE_LINK_TTL_MS;
}

export async function getSharedTracking(token: string): Promise<SharedTrackingDTO | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await supabase
    .from("order")
    .select(
      "status, description, completedAt, cancelledAt, providerLat, providerLng, providerLocationAt, address:address!order_addressId_fkey(lat, lng), client:user!order_clientId_fkey(fullName), provider:providerprofile(user:user!inner(fullName, avatarUrl)), category:category(name), service:service(name), events:orderevent(status, createdAt)",
    )
    .eq("shareToken", token)
    .maybeSingle();
  const o = data as unknown as {
    status: string;
    description: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    providerLat: number | null;
    providerLng: number | null;
    providerLocationAt: string | null;
    address: { lat: number; lng: number };
    client: { fullName: string };
    provider: { user: { fullName: string; avatarUrl: string | null } } | null;
    category: { name: string } | null;
    service: { name: string } | null;
    events: { status: string; createdAt: string }[];
  } | null;
  if (!o || !isShareLinkActive(o)) return null;

  const enRoute = o.status === "EN_ROUTE" && o.providerLat != null && o.providerLng != null;
  const etaMin = enRoute
    ? (await routeBetween({ lat: o.providerLat!, lng: o.providerLng! }, o.address)).durationMin
    : null;
  return {
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    clientFirstName: firstName(o.client.fullName),
    providerFirstName: o.provider ? firstName(o.provider.user.fullName) : null,
    providerAvatarUrl: o.provider?.user.avatarUrl ?? null,
    task: o.service?.name ?? o.description ?? o.category?.name ?? "Ajuda",
    etaMin,
    providerPosition: enRoute ? { lat: o.providerLat!, lng: o.providerLng! } : null,
    updatedAt: o.providerLocationAt,
    events: [...(o.events ?? [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => ({ label: STATUS_LABEL[e.status] ?? e.status, at: ensureUtcIso(e.createdAt) })),
  };
}

// ---------------------------------------------------------------------------
// Contato de confiança (perfil) e link do pedido (cliente)
// ---------------------------------------------------------------------------

export type TrustedContact = { name: string; email: string } | null;

export async function getTrustedContact(userId: string): Promise<TrustedContact> {
  const { data } = await supabase
    .from("user")
    .select("trustedContactName, trustedContactEmail")
    .eq("id", userId)
    .maybeSingle();
  return data?.trustedContactEmail
    ? { name: data.trustedContactName ?? "", email: data.trustedContactEmail }
    : null;
}

export async function setTrustedContact(userId: string, contact: TrustedContact): Promise<TrustedContact> {
  await supabase
    .from("user")
    .update({
      trustedContactName: contact?.name.trim() || null,
      trustedContactEmail: contact?.email.trim().toLowerCase() || null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", userId);
  return getTrustedContact(userId);
}

export async function getOrderShare(
  orderId: string,
  userId: string,
): Promise<{ url: string; contactName: string | null } | null> {
  const [{ data: order }, contact] = await Promise.all([
    supabase.from("order").select("clientId, shareToken").eq("id", orderId).maybeSingle(),
    getTrustedContact(userId),
  ]);
  if (!order || order.clientId !== userId || !order.shareToken) return null;
  return { url: shareUrl(order.shareToken), contactName: contact?.name || null };
}
