import { randomUUID } from "node:crypto";

import type { Json, OrderRow, OrderStatus, PaymentMethod, PaymentStatus } from "@judeu/db";

import { coarsen, effectiveProviderPosition } from "./catalog";
import { getConfig } from "./config";
import { ensureUtcIso } from "./dates";
import { DOOR_CODE_MAX_ATTEMPTS, DOOR_CODE_MESSAGES, checkDoorCode, generateDoorCode } from "./door-code";
import { recordEtaMeasurement, recordEtaPrediction } from "./eta-tracking";
import { isUserBlocked } from "./moderation";
import { REVERIFY_MESSAGES, REVERIFY_STATUS, requireReverification, reverifyDecision } from "./reverify";
import { PREFERENCES_DENIED, type OrderPreferences, hasPreferences, meetsPreferences } from "./preferences";
import { RISK_DENIED_MESSAGE, canTakeRisk, effectiveRisk, normalizeRisk, type RiskLevel } from "./risk";
import { trackEvent } from "./events";
import { type FamilyEvent, newShareToken, notifyTrustedContact } from "./family";
import { completionWalletMovement, computeFees, feeRuleOf, resolveFeeRule } from "./fees";
import { supabase } from "./db";
import { haversineKm, routeBetween } from "./geo";
import { notifyUser } from "./notifications";
import { onDutyAnchorIds } from "./anchors-admin";
import { type EscalationLevel, escalationTarget, radiusScale } from "./escalation";
import { releaseOrderDiscounts, recordDiscountUse, resolveDiscount } from "./discounts";
import { areaDenial, type AreaStatus, formatBrasiliaDateTime } from "./zones";
import { checkArea } from "./zones-db";
import { applyWalletMovement, refundIfPaid, syncOrderPaymentStatus } from "./payments";
import { batchClientStats } from "./profile";

/** Taxa dos pedidos antigos (regra legada). Pedidos novos usam a configuração — ver fees.ts. */
export const PLATFORM_FEE_RATE = 0.08;
export const FALLBACK_LAT = -10.1841;
export const FALLBACK_LNG = -48.3336;
const ARRIVAL_RADIUS_KM = 0.15;
/** Folga para o relógio do aparelho: "agendar para agora" não é recusado. */
const SCHEDULE_PAST_TOLERANCE_MS = 5 * 60_000;
export const OFFER_TTL_MS = 60_000;
export const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;
const OPEN_REQUEST_MIN_CHARS = 8;
const OPEN_NOTIFY_LIMIT = 100;
export const BUSY_ORDER_STATUSES = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"] as const;

type LatLng = { lat: number; lng: number };

function hasArrivedAt(
  providerLat: number | null,
  providerLng: number | null,
  address: LatLng,
): boolean {
  if (providerLat == null || providerLng == null) return false;
  return haversineKm({ lat: providerLat, lng: providerLng }, address) <= ARRIVAL_RADIUS_KM;
}

export function isInsideServiceRadius(
  origin: { lat: number; lng: number } | null,
  radiusKm: number,
  point: { lat: number; lng: number },
): boolean {
  if (!origin) return false;
  return haversineKm(origin, point) <= radiusKm;
}

export type OrderAction =
  | "accept"
  | "reject"
  | "start_route"
  | "start_work"
  | "complete"
  | "confirm_completion"
  | "cancel";

export const TRANSITIONS: Record<
  OrderAction,
  { from: OrderStatus[]; to: OrderStatus; by: "client" | "provider" }
> = {
  accept: { from: ["CREATED"], to: "ACCEPTED", by: "provider" },
  reject: { from: ["CREATED"], to: "CANCELLED", by: "provider" },
  start_route: { from: ["ACCEPTED"], to: "EN_ROUTE", by: "provider" },
  start_work: { from: ["EN_ROUTE"], to: "IN_PROGRESS", by: "provider" },
  complete: { from: ["IN_PROGRESS"], to: "AWAITING_CONFIRMATION", by: "provider" },
  confirm_completion: { from: ["AWAITING_CONFIRMATION"], to: "COMPLETED", by: "client" },
  cancel: { from: ["CREATED", "ACCEPTED"], to: "CANCELLED", by: "client" },
};

type AddressRow = {
  label: string | null;
  street: string;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

function toAddressDTO(a: AddressRow) {
  return {
    label: a.label,
    street: a.street,
    number: a.number,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    lat: a.lat,
    lng: a.lng,
  };
}

const ORDER_SELECT = `
  *,
  service:service(id, name, priceCents),
  category:category(id, name),
  address:address!order_addressId_fkey(*),
  pickupAddress:address!order_pickupAddressId_fkey(*),
  provider:providerprofile(
    id, isCompany, responsibleName, companyName, headline, ratingAvg, allowsNegotiation, userId,
    user:user!inner(id, fullName, avatarUrl)
  ),
  client:user!order_clientId_fkey(id, fullName, phone, avatarUrl, createdAt, phoneVerified, emailVerified),
  events:orderevent(*),
  payment:payment(status, method)
`;

type PaymentEmbed = { status: PaymentStatus; method: PaymentMethod };

type OrderFull = {
  id: string;
  clientId: string;
  providerId: string | null;
  status: OrderStatus;
  description: string | null;
  scheduledAt: string | null;
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  feeRate?: number | null;
  feePayer?: string | null;
  doorCode?: string | null;
  doorCodeAttempts?: number | null;
  escalationLevel?: number | null;
  discountCents?: number | null;
  creditUsedCents?: number | null;
  couponCode?: string | null;
  riskLevel?: number | null;
  prefMinRating?: number | null;
  prefMinCompleted?: number | null;
  prefGender?: "F" | "M" | null;
  cancelReason: string | null;
  createdAt: string;
  isOpenRequest: boolean;
  detailsReady: boolean;
  providerLat: number | null;
  providerLng: number | null;
  providerLocationAt: string | null;
  addressId: string;
  pickupAddressId: string | null;
  service: { id: string; name: string; priceCents: number } | null;
  category: { id: string; name: string } | null;
  address: AddressRow;
  pickupAddress: AddressRow | null;
  provider: {
    id: string;
    userId: string;
    isCompany: boolean;
    responsibleName: string | null;
    companyName: string | null;
    headline: string | null;
    ratingAvg: number;
    allowsNegotiation: boolean;
    user: { id: string; fullName: string; avatarUrl: string | null };
  } | null;
  client: {
    id: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: string;
    phoneVerified: boolean;
    emailVerified: boolean;
  };
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
  payment: PaymentEmbed | PaymentEmbed[] | null;
};

/** PostgREST pode devolver 1:1 como objeto ou array — normaliza pro DTO. */
function paymentFromEmbed(
  payment: OrderFull["payment"],
): { status: PaymentStatus; method: PaymentMethod } | null {
  if (!payment) return null;
  const row = Array.isArray(payment) ? payment[0] : payment;
  if (!row?.status || !row?.method) return null;
  return { status: row.status, method: row.method };
}

function trackingDestination(order: {
  status: OrderStatus;
  address: LatLng;
  pickupAddress: LatLng | null;
}): LatLng {
  if (order.pickupAddress && (order.status === "ACCEPTED" || order.status === "EN_ROUTE")) {
    return order.pickupAddress;
  }
  return order.address;
}

export type OrderDTO = {
  id: string;
  status: OrderStatus;
  description: string | null;
  scheduledAt: string | null;
  priceCents: number;
  platformFeeCents: number;
  totalCents: number;
  /** Quem paga a taxa neste pedido (snapshot): CLIENT = somada; PROVIDER = descontada do repasse. */
  feePayer: "CLIENT" | "PROVIDER";
  feeRate: number;
  /** O que quem atende recebe por este pedido. */
  providerNetCents: number;
  /** Desconto (cupom + crédito) já abatido do total. A plataforma absorve. */
  discountCents: number;
  couponCode: string | null;
  /** Quem atende precisa digitar o código de chegada para iniciar (o código em si nunca vai no DTO). */
  requiresDoorCode: boolean;
  /** 1 livre · 2 selo de reparos · 3 profissional com credencial. */
  riskLevel: number;
  preferences: OrderPreferences;
  cancelReason: string | null;
  createdAt: string;
  offerExpiresAt: string;
  isOpenRequest: boolean;
  detailsReady: boolean;
  unreadMessages: number;
  service: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  provider: {
    id: string;
    name: string;
    companyName: string | null;
    headline: string | null;
    avatarUrl: string | null;
    ratingAvg: number;
    allowsNegotiation: boolean;
  } | null;
  client: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    ratingAvg: number | null;
    ratingCount: number;
    completedOrders: number;
    cancelledOrders: number;
    totalOrders: number;
  };
  payment: { status: PaymentStatus; method: PaymentMethod } | null;
  address: ReturnType<typeof toAddressDTO>;
  pickupAddress: ReturnType<typeof toAddressDTO> | null;
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
  tracking: {
    providerLat: number | null;
    providerLng: number | null;
    updatedAt: string | null;
    distanceKm: number | null;
    etaMin: number | null;
    route: { lat: number; lng: number }[] | null;
    arrived: boolean;
  };
};

function toDTO(o: OrderFull, unreadMessages = 0): OrderDTO {
  const dest = trackingDestination(o);
  const openWait = o.isOpenRequest && !o.providerId && o.status === "CREATED";
  const createdAtMs = new Date(ensureUtcIso(o.createdAt)).getTime();
  // Ajuda aberta agendada só começa a expirar no horário marcado (mesma regra do cron).
  const waitStartMs =
    openWait && o.scheduledAt ? Math.max(createdAtMs, new Date(ensureUtcIso(o.scheduledAt)).getTime()) : createdAtMs;
  return {
    id: o.id,
    status: o.status,
    description: o.description,
    scheduledAt: o.scheduledAt,
    priceCents: o.priceCents,
    platformFeeCents: o.platformFeeCents,
    totalCents: o.totalCents,
    feePayer: feeRuleOf(o).payer,
    feeRate: feeRuleOf(o).rate,
    providerNetCents:
      feeRuleOf(o).payer === "PROVIDER" ? o.priceCents - o.platformFeeCents : o.priceCents,
    discountCents: o.discountCents ?? 0,
    couponCode: o.couponCode ?? null,
    requiresDoorCode: !!o.doorCode,
    riskLevel: normalizeRisk(o.riskLevel),
    preferences: orderPreferences(o),
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    offerExpiresAt: new Date(
      waitStartMs + (openWait ? OPEN_REQUEST_TTL_MS : OFFER_TTL_MS),
    ).toISOString(),
    isOpenRequest: o.isOpenRequest,
    detailsReady: o.detailsReady,
    unreadMessages,
    service: o.service ? { id: o.service.id, name: o.service.name } : null,
    category: o.category ? { id: o.category.id, name: o.category.name } : null,
    provider: o.provider
      ? {
          id: o.provider.id,
          name:
            o.provider.isCompany && o.provider.responsibleName
              ? o.provider.responsibleName
              : o.provider.user.fullName,
          companyName: o.provider.isCompany ? o.provider.companyName : null,
          headline: o.provider.headline,
          avatarUrl: o.provider.user.avatarUrl,
          ratingAvg: o.provider.ratingAvg,
          allowsNegotiation: o.provider.allowsNegotiation,
        }
      : null,
    client: {
      id: o.client.id,
      name: o.client.fullName,
      phone: o.client.phone,
      avatarUrl: o.client.avatarUrl,
      createdAt: o.client.createdAt,
      phoneVerified: !!o.client.phoneVerified,
      emailVerified: !!o.client.emailVerified,
      ratingAvg: null,
      ratingCount: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalOrders: 0,
    },
    payment: paymentFromEmbed(o.payment),
    address: toAddressDTO(o.address),
    pickupAddress: o.pickupAddress ? toAddressDTO(o.pickupAddress) : null,
    events: [...(o.events ?? [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
    tracking: {
      providerLat: o.providerLat,
      providerLng: o.providerLng,
      updatedAt: o.providerLocationAt,
      distanceKm: null,
      etaMin: null,
      route: null,
      arrived: hasArrivedAt(o.providerLat, o.providerLng, dest),
    },
  };
}

export const REDACTED_STREET = "Endereço exato liberado após o aceite";

function redactAddress(a: OrderDTO["address"]): OrderDTO["address"] {
  return {
    ...a,
    label: null,
    street: REDACTED_STREET,
    number: null,
    lat: coarsen(a.lat) as number,
    lng: coarsen(a.lng) as number,
  };
}

/**
 * Visão de uma ajuda aberta para quem ainda não aceitou (QA A-07/P-07): sem
 * telefone e sem endereço exato. Bairro, cidade e posição aproximada bastam
 * para decidir; o resto é liberado no aceite.
 */
export function redactOpenPoolOrder(dto: OrderDTO): OrderDTO {
  return {
    ...dto,
    client: { ...dto.client, phone: null },
    address: redactAddress(dto.address),
    pickupAddress: dto.pickupAddress ? redactAddress(dto.pickupAddress) : null,
  };
}

async function withOpenRequestClientStats(dtos: OrderDTO[]): Promise<OrderDTO[]> {
  const openClientIds = dtos.filter((o) => o.isOpenRequest).map((o) => o.client.id);
  if (openClientIds.length === 0) return dtos;
  const stats = await batchClientStats(openClientIds);
  return dtos.map((dto) => {
    if (!dto.isOpenRequest) return dto;
    const s = stats.get(dto.client.id);
    if (!s) return dto;
    return {
      ...dto,
      client: {
        ...dto.client,
        ratingAvg: s.ratingAvg,
        ratingCount: s.ratingCount,
        completedOrders: s.completedOrders,
        cancelledOrders: s.cancelledOrders,
        totalOrders: s.totalOrders,
      },
    };
  });
}

const routeCache = new Map<string, { expiresAt: number; route: Awaited<ReturnType<typeof routeBetween>> }>();
const ROUTE_CACHE_TTL_MS = 20_000;

async function withRoute(order: OrderFull, dto: OrderDTO): Promise<OrderDTO> {
  if (order.providerLat == null || order.providerLng == null) return dto;
  const dest = trackingDestination(order);
  const cacheKey = `${order.id}:${order.status}:${order.providerLat.toFixed(4)},${order.providerLng.toFixed(4)}:${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now && cached.route) {
    dto.tracking.distanceKm = cached.route.distanceKm;
    dto.tracking.etaMin = cached.route.durationMin;
    dto.tracking.route = cached.route.points;
    return dto;
  }
  const route = await routeBetween({ lat: order.providerLat, lng: order.providerLng }, dest);
  routeCache.set(cacheKey, { expiresAt: now + ROUTE_CACHE_TTL_MS, route });
  dto.tracking.distanceKm = route.distanceKm;
  dto.tracking.etaMin = route.durationMin;
  dto.tracking.route = route.points;
  return dto;
}

async function fetchOrder(id: string): Promise<OrderFull | null> {
  const { data, error } = await supabase.from("order").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as OrderFull | null;
}

/** Se o Stripe já confirmou e o banco ainda está PENDING, alinha antes do DTO. */
async function withSyncedPayment(order: OrderFull): Promise<OrderFull> {
  const pay = paymentFromEmbed(order.payment);
  if (
    order.status !== "ACCEPTED" &&
    order.status !== "EN_ROUTE" &&
    order.status !== "IN_PROGRESS"
  ) {
    return order;
  }
  if (!pay || pay.status !== "PENDING" || pay.method === "CASH") return order;
  await syncOrderPaymentStatus(order.id);
  return (await fetchOrder(order.id)) ?? order;
}

export type CreateOrderInput = {
  providerId?: string;
  serviceId?: string;
  categoryId?: string;
  description?: string;
  scheduledAt?: string;
  addressId?: string;
  pickupAddressId?: string;
  priceCents?: number;
  /** Preferências de quem atende (só ajuda aberta). */
  preferences?: OrderPreferences;
  /** Sugestão de risco da IA (1–4). Só sobe o nível da categoria, nunca baixa. */
  riskHint?: number;
  /** Cupom digitado pelo cliente. */
  couponCode?: string;
  /** Abater o crédito do cliente. */
  useCredits?: boolean;
};

/** Perfil elegível a push de ajuda aberta (modo atendimento ligado). */
export type OpenRequestAudienceProfile = {
  id: string;
  userId: string;
  isHelper: boolean;
  serviceRadiusKm: number;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
  baseLat: number | null;
  baseLng: number | null;
  categories: { categoryId: string }[];
  badges?: { type: string; expiresAt: string | null }[] | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  completedCount?: number | null;
  gender?: string | null;
};

/**
 * Quem recebe push de ajuda aberta:
 * - disponível (já filtrado na query) e com GPS no raio;
 * - helper: qualquer pedido no raio (está "procurando ajudar");
 * - profissional: só se a categoria do pedido bater com as dele (ou pedido sem categoria).
 */
export function matchesOpenRequestAudience(
  profile: OpenRequestAudienceProfile,
  order: {
    categoryId: string | null;
    address: LatLng;
    riskLevel?: number;
    preferences?: OrderPreferences | null;
    /** Escalonamento: multiplica o raio de cada pessoa (padrão 1). */
    radiusScale?: number;
  },
  busyIds: Set<string>,
): boolean {
  if (busyIds.has(profile.id)) return false;
  if (!meetsPreferences(profile, order.preferences)) return false;
  // Nível de tarefa: só quem tem a qualificação recebe/vê (pitch, rodada 3).
  if (!canTakeRisk(profile, normalizeRisk(order.riskLevel))) return false;
  const origin = effectiveProviderPosition(profile);
  if (!isInsideServiceRadius(origin, profile.serviceRadiusKm * (order.radiusScale ?? 1), order.address)) return false;
  if (profile.isHelper) return true;
  if (!order.categoryId) return true;
  return profile.categories.some((c) => c.categoryId === order.categoryId);
}

/** Quem está aprovado, disponível e livre — a base do push e da prévia "N perto". */
async function loadOpenRequestAudience(excludeUserId: string) {
  const { data: rows } = await supabase
    .from("providerprofile")
    .select(
      "id, userId, isHelper, serviceRadiusKm, lastLat, lastLng, lastLocationAt, baseLat, baseLng, ratingAvg, ratingCount, categories:providercategory(categoryId), badges:providerbadge(type, expiresAt), user:user!inner(gender)",
    )
    .eq("status", "APPROVED")
    .eq("isAvailable", true)
    .neq("userId", excludeUserId);
  const ids = (rows ?? []).map((r) => r.id);
  const completed = await completedCounts(ids);

  const { data: busy } = await supabase
    .from("order")
    .select("providerId")
    .in("status", [...BUSY_ORDER_STATUSES])
    .not("providerId", "is", null);
  const busyIds = new Set(
    (busy ?? []).map((o) => o.providerId).filter((id): id is string => Boolean(id)),
  );
  const profiles = ((rows ?? []) as unknown as (OpenRequestAudienceProfile & {
    user: { gender: string | null } | null;
  })[]).map(({ user, ...p }) => ({ ...p, gender: user?.gender ?? null, completedCount: completed.get(p.id) ?? 0 }));
  return { rows: profiles as OpenRequestAudienceProfile[], busyIds };
}

/** Tarefas concluídas por quem atende (filtro "mais de N tarefas"). */
async function completedCounts(providerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (providerIds.length === 0) return map;
  const { data } = await supabase
    .from("order")
    .select("providerId")
    .eq("status", "COMPLETED")
    .in("providerId", providerIds);
  for (const o of data ?? []) if (o.providerId) map.set(o.providerId, (map.get(o.providerId) ?? 0) + 1);
  return map;
}

export type AvailabilitySummary = {
  /** Quantas pessoas receberiam o pedido agora. */
  count: number;
  helpers: number;
  professionals: number;
  /** Distância em linha reta até a mais próxima. */
  nearestKm: number | null;
};

/** Mesmo público do push de ajuda aberta, agregado (sem identificar ninguém). */
export function summarizeAvailability(
  profiles: OpenRequestAudienceProfile[],
  request: { categoryId: string | null; address: LatLng; riskLevel?: number; preferences?: OrderPreferences | null },
  busyIds: Set<string>,
): AvailabilitySummary & { nearest: LatLng | null } {
  let helpers = 0;
  let professionals = 0;
  let nearest: LatLng | null = null;
  let nearestKm: number | null = null;
  for (const p of profiles) {
    if (!matchesOpenRequestAudience(p, request, busyIds)) continue;
    if (p.isHelper) helpers += 1;
    else professionals += 1;
    const pos = effectiveProviderPosition(p);
    if (!pos) continue;
    const km = haversineKm(pos, request.address);
    if (nearestKm == null || km < nearestKm) {
      nearestKm = km;
      nearest = pos;
    }
  }
  return { count: helpers + professionals, helpers, professionals, nearestKm, nearest };
}

/**
 * Prévia antes de publicar uma ajuda aberta: quantas pessoas estão perto e em
 * quanto tempo a mais próxima chega (rota real só para ela; o resto é contagem).
 */
export async function openRequestAvailability(
  clientId: string,
  point: LatLng,
  categoryId: string | null,
  preferences: OrderPreferences | null = null,
): Promise<AvailabilitySummary & { etaMin: number | null; area: AreaStatus }> {
  const [{ rows, busyIds }, { data: category }, area] = await Promise.all([
    loadOpenRequestAudience(clientId),
    categoryId
      ? supabase.from("category").select("riskLevel").eq("id", categoryId).maybeSingle()
      : Promise.resolve({ data: null }),
    checkArea(point),
  ]);
  const { nearest, ...summary } = summarizeAvailability(
    rows,
    { categoryId, address: point, riskLevel: category?.riskLevel ?? 1, preferences },
    busyIds,
  );
  let etaMin: number | null = null;
  if (nearest) {
    const route = await routeBetween(nearest, point);
    etaMin = route.durationMin;
  }
  void trackEvent({
    type: "nearby.viewed",
    userId: clientId,
    props: { count: summary.count, categoryId, etaMin },
  });
  return {
    ...summary,
    nearestKm: summary.nearestKm == null ? null : Math.round(summary.nearestKm * 10) / 10,
    etaMin,
    area,
  };
}

async function notifyAvailableProviders(order: OrderFull) {
  const { rows, busyIds } = await loadOpenRequestAudience(order.clientId);

  const categoryId = order.category?.id ?? null;
  const body = order.description?.trim() || order.category?.name || "Alguém precisa de ajuda";
  let sent = 0;
  for (const p of rows) {
    if (
      !matchesOpenRequestAudience(
        p,
        {
          categoryId,
          address: { lat: order.address.lat, lng: order.address.lng },
          riskLevel: order.riskLevel ?? 1,
          preferences: orderPreferences(order),
        },
        busyIds,
      )
    ) {
      continue;
    }
    void notifyUser(p.userId, "ORDER", {
      title: order.scheduledAt ? `Nova solicitação para ${formatBrasiliaDateTime(order.scheduledAt)}` : "Nova solicitação",
      body,
      data: { type: "order", orderId: order.id, role: "provider" },
    });
    sent += 1;
    if (sent >= OPEN_NOTIFY_LIMIT) break;
  }
}

type EscalationCandidate = {
  id: string;
  clientId: string;
  description: string | null;
  createdAt: string;
  scheduledAt: string | null;
  categoryId: string | null;
  riskLevel: number | null;
  escalationLevel: number | null;
  prefMinRating: number | null;
  prefMinCompleted: number | null;
  prefGender: "F" | "M" | null;
  address: { lat: number; lng: number } | { lat: number; lng: number }[] | null;
  category: { name: string } | { name: string }[] | null;
};

/**
 * Escalonamento (cron): ajuda aberta sem aceite sobe de nível com o tempo.
 * Nível 1 avisa os âncoras de plantão; nível 2 amplia o raio e avisa quem passou
 * a alcançar o pedido. Cada nível é gravado com trava (só sobe uma vez).
 */
export async function escalateOpenRequests(now = new Date()): Promise<{ anchors: number; widened: number; notified: number }> {
  const config = await getConfig();
  if (config.escalateAnchorsAfterMin <= 0 && config.escalateRadiusAfterMin <= 0) {
    return { anchors: 0, widened: 0, notified: 0 };
  }
  const { data, error } = await supabase
    .from("order")
    .select(
      "id, clientId, description, createdAt, scheduledAt, categoryId, riskLevel, escalationLevel, prefMinRating, prefMinCompleted, prefGender, address:address!order_addressId_fkey(lat, lng), category:category(name)",
    )
    .eq("status", "CREATED")
    .eq("isOpenRequest", true)
    .is("providerId", null)
    .lt("escalationLevel", 2)
    .order("createdAt", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const due = ((data ?? []) as unknown as EscalationCandidate[])
    .map((o) => ({ order: o, target: escalationTarget(o, config, now) }))
    .filter(({ order, target }) => target > (order.escalationLevel ?? 0));
  if (due.length === 0) return { anchors: 0, widened: 0, notified: 0 };

  const anchorIds = await onDutyAnchorIds(now);
  // O público é o mesmo para todos os pedidos de um cliente (só exclui ele mesmo).
  const audienceByClient = new Map<string, Awaited<ReturnType<typeof loadOpenRequestAudience>>>();
  let anchors = 0;
  let widened = 0;
  let notified = 0;
  const mult = config.escalationRadiusMultiplier;

  for (const { order, target } of due) {
    const from = (order.escalationLevel ?? 0) as EscalationLevel;
    const { data: claimed } = await supabase
      .from("order")
      .update({ escalationLevel: target, escalatedAt: now.toISOString() })
      .eq("id", order.id)
      .eq("status", "CREATED")
      .eq("escalationLevel", from)
      .select("id");
    if (!claimed?.length) continue;

    const address = Array.isArray(order.address) ? order.address[0] : order.address;
    if (!address) continue;
    const category = Array.isArray(order.category) ? order.category[0] : order.category;
    let audience = audienceByClient.get(order.clientId);
    if (!audience) {
      audience = await loadOpenRequestAudience(order.clientId);
      audienceByClient.set(order.clientId, audience);
    }
    const base = {
      categoryId: order.categoryId,
      address: { lat: address.lat, lng: address.lng },
      riskLevel: order.riskLevel ?? 1,
      preferences: orderPreferences(order),
    };
    const body = order.description?.trim() || category?.name || "Alguém precisa de ajuda";
    const recipients = new Set<string>();
    for (const p of audience.rows) {
      const wide = matchesOpenRequestAudience(p, { ...base, radiusScale: mult }, audience.busyIds);
      if (!wide) continue;
      // Nível 1: âncoras de plantão, mesmo um pouco além do raio deles.
      if (from < 1 && target >= 1 && anchorIds.has(p.id)) recipients.add(p.userId);
      // Nível 2: quem só alcança o pedido com o raio ampliado (os outros já foram avisados).
      if (from < 2 && target >= 2 && !matchesOpenRequestAudience(p, base, audience.busyIds)) recipients.add(p.userId);
      if (recipients.size >= OPEN_NOTIFY_LIMIT) break;
    }
    for (const userId of recipients) {
      void notifyUser(userId, "ORDER", {
        title: "Ainda sem ninguém: ajuda perto de você",
        body,
        data: { type: "order", orderId: order.id, role: "provider" },
      });
    }
    notified += recipients.size;
    if (from < 1 && target >= 1) anchors += 1;
    if (from < 2 && target >= 2) {
      widened += 1;
      void notifyUser(order.clientId, "ORDER", {
        title: "Ampliamos a busca",
        body: "Ninguém aceitou ainda, então avisamos mais gente um pouco mais longe.",
        data: { type: "order", orderId: order.id, role: "client" },
      });
    }
    void trackEvent({
      type: "order.escalated",
      userId: order.clientId,
      props: { orderId: order.id, from, to: target, notified: recipients.size },
    });
  }
  return { anchors, widened, notified };
}

export async function createOrder(
  clientId: string,
  input: CreateOrderInput,
): Promise<OrderDTO | { error: string; status: number }> {
  if (await isUserBlocked(clientId)) {
    return { error: "Sua conta está suspensa. Fale com o suporte.", status: 403 };
  }
  const isOpenRequest = !input.providerId;
  const description = input.description?.trim() || undefined;

  if (isOpenRequest && (!description || description.length < OPEN_REQUEST_MIN_CHARS)) {
    return { error: "Descreva o que você precisa", status: 400 };
  }
  if (isOpenRequest) {
    if (input.priceCents == null || !Number.isInteger(input.priceCents) || input.priceCents < 100) {
      return { error: "Informe quanto você vai pagar", status: 400 };
    }
  }

  let addressId = input.addressId;
  if (isOpenRequest && !addressId) {
    const { data: fallback } = await supabase
      .from("address")
      .select("id")
      .eq("userId", clientId)
      .order("isDefault", { ascending: false })
      .order("createdAt", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!fallback) {
      return { error: "Cadastre um endereço no perfil para publicar o pedido", status: 400 };
    }
    addressId = fallback.id;
  }
  if (!addressId) return { error: "Endereço inválido", status: 400 };

  const { data: address } = await supabase.from("address").select("*").eq("id", addressId).maybeSingle();
  if (!address || address.userId !== clientId) {
    return { error: "Endereço inválido", status: 400 };
  }

  // Agendamento e zona de atendimento (Fase 6). Sem zona ativa, checkArea libera tudo.
  const config = await getConfig();
  const nowMs = Date.now();
  const scheduledMs = input.scheduledAt ? new Date(input.scheduledAt).getTime() : null;
  if (scheduledMs != null) {
    if (scheduledMs < nowMs - SCHEDULE_PAST_TOLERANCE_MS) {
      return { error: "Escolha uma data e hora futuras", status: 400 };
    }
    if (scheduledMs > nowMs + config.scheduleMaxDays * 24 * 60 * 60_000) {
      return { error: `Dá para agendar até ${config.scheduleMaxDays} dias à frente`, status: 400 };
    }
  }
  const scheduledLater = scheduledMs != null && scheduledMs > nowMs;
  const area = await checkArea(
    { lat: address.lat, lng: address.lng },
    new Date(scheduledLater ? scheduledMs! : nowMs),
  );
  const denial = areaDenial(area, scheduledLater);
  if (denial) return denial;

  let priceCents = 0;
  let serviceId: string | undefined;
  type ProviderPick = {
    id: string;
    userId: string;
    isHelper: boolean;
    services: { id: string; priceCents: number; categoryId: string }[];
    badges: { type: string; expiresAt: string | null }[];
  };
  let serviceCategoryId: string | null = null;
  let provider: ProviderPick | null = null;

  if (!isOpenRequest) {
    const { data: found } = await supabase
      .from("providerprofile")
      .select("*, services:service(id, priceCents, categoryId), badges:providerbadge(type, expiresAt)")
      .eq("id", input.providerId!)
      .maybeSingle();
    if (!found || found.status !== "APPROVED" || !found.isAvailable) {
      return { error: "Essa pessoa não está disponível agora", status: 400 };
    }
    // Helper não tem catálogo: só atende ajudas abertas (QA C-06/H-03).
    if (found.isHelper) {
      return { error: "Essa pessoa atende só pedidos de ajuda abertos", status: 400 };
    }
    // Sem serviço escolhido o pedido nascia com R$ 0. Só vale sem serviço quando
    // o prestador aceita negociar (o valor sai do orçamento).
    if (!input.serviceId && !found.allowsNegotiation) {
      return { error: "Escolha um dos serviços do prestador", status: 400 };
    }
    const { data: busy } = await supabase
      .from("order")
      .select("id")
      .eq("providerId", found.id)
      .in("status", [...BUSY_ORDER_STATUSES])
      .limit(1)
      .maybeSingle();
    if (busy) return { error: "Essa pessoa já está em uma chamada", status: 409 };
    provider = found as unknown as ProviderPick;
    if (input.serviceId) {
      const service = provider!.services.find((s) => s.id === input.serviceId);
      if (!service) return { error: "Serviço não pertence ao prestador", status: 400 };
      priceCents = service.priceCents;
      serviceId = service.id;
      serviceCategoryId = service.categoryId;
    }
  } else {
    priceCents = input.priceCents!;
  }

  // Snapshot da regra de cobrança: o pedido fica com ela até o fim.
  const riskCategoryId = input.categoryId ?? serviceCategoryId;
  const { data: category } = riskCategoryId
    ? await supabase
        .from("category")
        .select("feeRate, riskLevel, expectedDurationMin")
        .eq("id", riskCategoryId)
        .maybeSingle()
    : { data: null };
  const feeRule = resolveFeeRule(config, input.categoryId ? category : null);
  // Nível de tarefa: proibido nem é criado; chamada direta só para quem pode.
  const riskLevel: RiskLevel = effectiveRisk(category?.riskLevel, input.riskHint);
  if (riskLevel === 4) return { error: RISK_DENIED_MESSAGE[4], status: 400 };
  if (provider && !canTakeRisk(provider, riskLevel)) {
    return { error: `Essa pessoa não pode fazer esta tarefa. ${RISK_DENIED_MESSAGE[riskLevel as 2 | 3]}`, status: 400 };
  }
  // Modo família: quem tem contato de confiança ganha link de acompanhamento.
  const { data: clientRow } = await supabase
    .from("user")
    .select("trustedContactEmail")
    .eq("id", clientId)
    .maybeSingle();
  const shareToken = clientRow?.trustedContactEmail ? newShareToken() : null;
  // Cupom e crédito: o desconto sai da parte da plataforma (quem atende recebe igual).
  const discount = await resolveDiscount(clientId, {
    couponCode: input.couponCode,
    useCredits: input.useCredits,
    priceCents,
    grossTotalCents: computeFees(priceCents, feeRule).totalCents,
  });
  if ("error" in discount) return discount;
  const { platformFeeCents, totalCents, discountCents } = computeFees(priceCents, feeRule, discount.totalCents);
  const orderId = randomUUID();

  const { data: created, error } = await supabase.rpc("create_order_with_event", {
    p_order: {
      id: orderId,
      clientId,
      providerId: provider?.id ?? null,
      serviceId: serviceId ?? null,
      categoryId: input.categoryId ?? null,
      addressId: address.id,
      isOpenRequest,
      detailsReady: !isOpenRequest,
      description: description ?? null,
      scheduledAt: input.scheduledAt ?? null,
      priceCents,
      platformFeeCents,
      totalCents,
      feeRate: feeRule.rate,
      feePayer: feeRule.payer,
      status: "CREATED",
    } as Json,
    p_event_note: isOpenRequest ? "Solicitação publicada" : "Chamada enviada",
  });
  if (error || !created) return { error: error?.message ?? "Falha ao criar pedido", status: 500 };

  await supabase
    .from("order")
    .update({
      ...(shareToken ? { shareToken } : {}),
      ...(isOpenRequest && hasPreferences(input.preferences)
        ? {
            prefMinRating: input.preferences?.minRating ?? null,
            prefMinCompleted: input.preferences?.minCompleted ?? null,
            prefGender: input.preferences?.gender ?? null,
          }
        : {}),
      riskLevel,
      expectedDurationMin: category?.expectedDurationMin ?? config.defaultExpectedDurationMin,
      ...(discountCents > 0
        ? {
            discountCents,
            creditUsedCents: discount.creditCents,
            couponId: discount.couponCents > 0 ? discount.couponId : null,
            couponCode: discount.couponCents > 0 ? discount.couponCode : null,
          }
        : {}),
    })
    .eq("id", (created as OrderRow).id);
  if (discountCents > 0) {
    await recordDiscountUse((created as OrderRow).id, clientId, {
      ...discount,
      couponId: discount.couponCents > 0 ? discount.couponId : null,
    });
  }

  const order = await fetchOrder((created as OrderRow).id);
  if (!order) return { error: "Pedido criado mas não encontrado", status: 500 };

  if (provider) {
    void notifyUser(provider.userId, "ORDER", {
      title: order.scheduledAt ? "Nova chamada agendada" : "Nova chamada",
      body: order.service?.name ?? order.category?.name ?? "Alguém está te chamando",
      data: { type: "order", orderId: order.id, role: "provider" },
    });
  } else {
    void notifyAvailableProviders(order);
  }

  return toDTO(order);
}

async function unreadMessageCounts(
  orderIds: string[],
  viewerId: string,
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const { data: rows } = await supabase
    .from("message")
    .select("orderId")
    .in("orderId", orderIds)
    .neq("senderId", viewerId)
    .is("readAt", null);
  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    map.set(r.orderId, (map.get(r.orderId) ?? 0) + 1);
  }
  return map;
}

export async function listClientOrders(clientId: string): Promise<OrderDTO[]> {
  const { data: rows, error } = await supabase
    .from("order")
    .select(ORDER_SELECT)
    .eq("clientId", clientId)
    .order("createdAt", { ascending: false });
  if (error) throw new Error(error.message);
  const list = await Promise.all(
    ((rows ?? []) as unknown as OrderFull[]).map((o) => withSyncedPayment(o)),
  );
  const unread = await unreadMessageCounts(
    list.map((o) => o.id),
    clientId,
  );
  return withOpenRequestClientStats(list.map((o) => toDTO(o, unread.get(o.id) ?? 0)));
}

async function listNearbyOpenRequests(
  userId: string,
  profile: {
    serviceRadiusKm: number;
    lastLat: number | null;
    lastLng: number | null;
    lastLocationAt: string | null;
    baseLat: number | null;
    baseLng: number | null;
  },
): Promise<OrderFull[]> {
  const origin = effectiveProviderPosition(profile);
  if (!origin) return [];
  const config = await getConfig();
  // Agendada conta a partir do horário marcado (mesma regra da expiração no cron).
  const minStart = new Date(Date.now() - config.openRequestTtlMs).toISOString();
  const { data: rows } = await supabase
    .from("order")
    .select(ORDER_SELECT)
    .eq("isOpenRequest", true)
    .is("providerId", null)
    .eq("status", "CREATED")
    .neq("clientId", userId)
    .or(`createdAt.gte.${minStart},scheduledAt.gte.${minStart}`)
    .order("createdAt", { ascending: false })
    .limit(200);
  return ((rows ?? []) as unknown as OrderFull[])
    .filter((row) =>
      // Pedido escalonado aparece também para quem está mais longe (raio ampliado).
      isInsideServiceRadius(
        origin,
        profile.serviceRadiusKm * radiusScale(row.escalationLevel, config.escalationRadiusMultiplier),
        { lat: row.address.lat, lng: row.address.lng },
      ),
    )
    .slice(0, 40);
}

export async function listProviderOrders(userId: string): Promise<OrderDTO[]> {
  const { data: profile } = await supabase
    .from("providerprofile")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (!profile) return [];

  // Só perfil aprovado vê o pool de ajudas abertas (QA A-07/P-07), como no detalhe.
  const canSeePool = profile.status === "APPROVED";
  const [{ data: assigned }, open] = await Promise.all([
    supabase
      .from("order")
      .select(ORDER_SELECT)
      .eq("providerId", profile.id)
      .order("createdAt", { ascending: false }),
    canSeePool ? listNearbyOpenRequests(userId, profile) : Promise.resolve([] as OrderFull[]),
  ]);

  const seen = new Set<string>();
  const merged: OrderFull[] = [];
  for (const row of [...open, ...((assigned ?? []) as unknown as OrderFull[])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  const rows = await Promise.all(merged.map((o) => withSyncedPayment(o)));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = await unreadMessageCounts(
    rows.map((o) => o.id),
    userId,
  );
  return withOpenRequestClientStats(
    rows.map((o) => {
      const dto = toDTO(o, unread.get(o.id) ?? 0);
      return o.providerId === profile.id ? dto : redactOpenPoolOrder(dto);
    }),
  );
}

async function canViewOpenRequest(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("providerprofile")
    .select("status")
    .eq("userId", userId)
    .maybeSingle();
  return profile?.status === "APPROVED";
}

export async function getOrder(id: string, userId: string): Promise<OrderDTO | null> {
  let o = await fetchOrder(id);
  if (!o) return null;
  o = await withSyncedPayment(o);
  const isClient = o.clientId === userId;
  const isProvider = o.provider?.userId === userId;
  const openPool = o.isOpenRequest && !o.providerId && o.status === "CREATED";
  const poolViewer = !isClient && !isProvider;
  if (poolViewer) {
    if (!openPool || o.clientId === userId) return null;
    if (!(await canViewOpenRequest(userId))) return null;
  }
  const { count } = await supabase
    .from("message")
    .select("*", { count: "exact", head: true })
    .eq("orderId", id)
    .neq("senderId", userId)
    .is("readAt", null);
  const dto = await withRoute(o, toDTO(o, count ?? 0));
  const [enriched] = await withOpenRequestClientStats([dto]);
  const result = enriched ?? dto;
  return poolViewer ? redactOpenPoolOrder(result) : result;
}

export async function updateOrderLocation(
  id: string,
  userId: string,
  lat: number,
  lng: number,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await fetchOrder(id);
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  if (order.provider?.userId !== userId) {
    return { error: "Ação permitida apenas ao prestador do pedido", status: 403 };
  }
  if (order.status !== "ACCEPTED" && order.status !== "EN_ROUTE" && order.status !== "IN_PROGRESS") {
    return { error: "Pedido não está a caminho", status: 409 };
  }

  await supabase
    .from("order")
    .update({
      providerLat: lat,
      providerLng: lng,
      providerLocationAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  const updated = await fetchOrder(id);
  if (!updated) return { error: "Pedido não encontrado", status: 404 };
  const dto = await withRoute(updated, toDTO(updated));
  if (updated.status === "EN_ROUTE") {
    void recordEtaPrediction(id, { etaMin: dto.tracking.etaMin, distanceKm: dto.tracking.distanceKm });
  }
  return dto;
}

const ACTION_NOTES: Record<OrderAction, string> = {
  accept: "Chamada aceita",
  reject: "Chamada recusada",
  start_route: "Prestador a caminho",
  start_work: "Serviço em execução",
  complete: "Serviço marcado como concluído pelo prestador — aguardando confirmação do cliente",
  confirm_completion: "Cliente confirmou a conclusão do serviço",
  cancel: "Chamada cancelada",
};

/**
 * Geocerca da conclusão: "ok" no local; "away" com posição recente longe do
 * local; "unknown" sem posição recente (não bloqueia, mas fica registrado).
 */
export function completionGeofence(
  order: {
    status: OrderStatus;
    providerLat: number | null;
    providerLng: number | null;
    providerLocationAt: string | null;
    address: LatLng;
    pickupAddress: LatLng | null;
  },
  freshMs: number,
  now = Date.now(),
): "ok" | "away" | "unknown" {
  const at = order.providerLocationAt ? new Date(ensureUtcIso(order.providerLocationAt)).getTime() : 0;
  if (!at || now - at > freshMs || order.providerLat == null || order.providerLng == null) return "unknown";
  return hasArrivedAt(order.providerLat, order.providerLng, trackingDestination(order)) ? "ok" : "away";
}

const DOOR_CODE_STATUSES = new Set<OrderStatus>(["ACCEPTED", "EN_ROUTE"]);

/** Código de chegada — só para o cliente do pedido, enquanto alguém está a caminho. */
export async function getDoorCode(
  id: string,
  userId: string,
  regenerate = false,
): Promise<{ code: string | null; locked: boolean } | { error: string; status: number }> {
  const { data: order } = await supabase
    .from("order")
    .select("clientId, status, doorCode, doorCodeAttempts")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.clientId !== userId) return { error: "Pedido não encontrado", status: 404 };
  if (!DOOR_CODE_STATUSES.has(order.status) || !order.doorCode) return { code: null, locked: false };
  if (regenerate) {
    const code = generateDoorCode();
    await supabase.from("order").update({ doorCode: code, doorCodeAttempts: 0 }).eq("id", id);
    return { code, locked: false };
  }
  return { code: order.doorCode, locked: order.doorCodeAttempts >= DOOR_CODE_MAX_ATTEMPTS };
}

function orderPreferences(o: {
  prefMinRating?: number | null;
  prefMinCompleted?: number | null;
  prefGender?: "F" | "M" | null;
}): OrderPreferences {
  return { minRating: o.prefMinRating ?? null, minCompleted: o.prefMinCompleted ?? null, gender: o.prefGender ?? null };
}

/** Quem atende já tem outra chamada em andamento? (ignora o próprio pedido) */
async function isProviderBusy(providerId: string, exceptOrderId: string): Promise<boolean> {
  const { data: busy } = await supabase
    .from("order")
    .select("id")
    .eq("providerId", providerId)
    .in("status", [...BUSY_ORDER_STATUSES])
    .neq("id", exceptOrderId)
    .limit(1)
    .maybeSingle();
  return !!busy;
}

export async function transitionOrder(
  id: string,
  userId: string,
  action: OrderAction,
  note?: string,
  opts: { doorCode?: string } = {},
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await fetchOrder(id);
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const rule = TRANSITIONS[action];
  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  const openUnclaimed = order.isOpenRequest && !order.providerId && order.status === "CREATED";

  let claimProviderId: string | null = null;

  if (action === "accept" && openUnclaimed) {
    if (isClient) return { error: "Você não pode atender a própria solicitação", status: 403 };
    const { data: profile } = await supabase
      .from("providerprofile")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();
    if (!profile || profile.status !== "APPROVED") {
      return { error: "Só quem está aprovado para atender pode pegar essa solicitação", status: 403 };
    }
    if (!profile.isAvailable) {
      return { error: "Fique disponível para atender solicitações", status: 409 };
    }
    if (await isProviderBusy(profile.id, order.id)) {
      return { error: "Você já está em uma chamada", status: 409 };
    }
    // Preferências de quem pediu (nota, tarefas, gênero).
    const prefs = orderPreferences(order);
    if (hasPreferences(prefs)) {
      const [{ data: me }, done] = await Promise.all([
        supabase.from("user").select("gender").eq("id", userId).maybeSingle(),
        completedCounts([profile.id]),
      ]);
      const ok = meetsPreferences(
        { ratingAvg: profile.ratingAvg, ratingCount: profile.ratingCount, completedCount: done.get(profile.id) ?? 0, gender: me?.gender ?? null },
        prefs,
      );
      if (!ok) return { error: PREFERENCES_DENIED, status: 403 };
    }
    // Nível de tarefa: confere a qualificação de quem aceita.
    const risk = normalizeRisk(order.riskLevel);
    if (risk !== 1) {
      const { data: badges } = await supabase
        .from("providerbadge")
        .select("type, expiresAt")
        .eq("providerId", profile.id);
      if (!canTakeRisk({ isHelper: profile.isHelper, badges: badges ?? [] }, risk)) {
        return { error: RISK_DENIED_MESSAGE[risk as 2 | 3 | 4], status: 403 };
      }
    }
    // Profissional só pega ajuda da própria categoria; helper pega qualquer uma
    // (mesma regra do push — QA P-08/C-13).
    if (!profile.isHelper && order.category?.id) {
      const { data: link } = await supabase
        .from("providercategory")
        .select("categoryId")
        .eq("providerId", profile.id)
        .eq("categoryId", order.category.id)
        .maybeSingle();
      if (!link) {
        return { error: "Essa solicitação é de uma categoria que você não atende", status: 403 };
      }
    }
    claimProviderId = profile.id;
  } else if (rule.by === "provider" && !isProvider) {
    return { error: "Ação permitida apenas ao prestador", status: 403 };
  } else if (action === "accept" && order.providerId) {
    // Chamada direta: a mesma trava de "ocupado" da ajuda aberta (QA A-01/H-02/P-09).
    if (await isProviderBusy(order.providerId, order.id)) {
      return { error: "Termine a chamada em andamento antes de aceitar outra", status: 409 };
    }
  }
  if (rule.by === "client" && !isClient) {
    return { error: "Ação permitida apenas ao cliente", status: 403 };
  }
  if (action === "reject" && openUnclaimed) {
    return { error: "Solicitações abertas não se recusam — ignore ou aceite", status: 409 };
  }
  if (!rule.from.includes(order.status)) {
    return { error: `Transição inválida a partir de ${order.status}`, status: 409 };
  }
  if (action === "start_route") {
    // Sync Stripe → DB e normaliza embed (PostgREST pode devolver payment como array).
    let paidOrder = await withSyncedPayment(order);
    const pay = paymentFromEmbed(paidOrder.payment);
    const paid = pay?.status === "PAID" || pay?.method === "CASH";
    if (!paid) {
      return { error: "Aguardando o cliente confirmar o pagamento", status: 409 };
    }
  }
  if (action === "start_work") {
    const dest = trackingDestination(order);
    if (!hasArrivedAt(order.providerLat, order.providerLng, dest)) {
      return {
        error: order.pickupAddress
          ? "Você ainda não chegou ao local de busca"
          : "Você ainda não chegou ao local do cliente",
        status: 409,
      };
    }
    // Reverificação: às vezes pede uma selfie nova antes de começar.
    if (order.providerId) {
      const { data: me } = await supabase
        .from("providerprofile")
        .select("reverifyRequiredAt, lastSelfieAt")
        .eq("id", order.providerId)
        .maybeSingle();
      const decision = reverifyDecision(me ?? {}, await getConfig(), Math.random());
      if (decision === "required") {
        await requireReverification(order.providerId, "Verificação aleatória antes de começar");
        return { error: REVERIFY_MESSAGES.random, status: REVERIFY_STATUS };
      }
      if (decision === "pending") return { error: REVERIFY_MESSAGES.pending, status: REVERIFY_STATUS };
    }
    // Código na porta: confirma que é a pessoa certa antes de começar.
    const check = checkDoorCode(order, opts.doorCode);
    if (check === "wrong") {
      await supabase
        .from("order")
        .update({ doorCodeAttempts: (order.doorCodeAttempts ?? 0) + 1 })
        .eq("id", id);
    }
    if (check !== "ok" && check !== "not_required") {
      return { error: DOOR_CODE_MESSAGES[check], status: 409 };
    }
  }

  // Geocerca na conclusão: com posição recente, precisa estar no local.
  let completeNote: string | null = null;
  if (action === "complete") {
    const fence = completionGeofence(order, (await getConfig()).locationFreshMs);
    if (fence === "away") {
      return { error: "Para concluir, você precisa estar no local do atendimento.", status: 409 };
    }
    if (fence === "unknown") completeNote = "Concluído sem localização recente confirmada";
  }

  const now = new Date().toISOString();
  const acceptNote = claimProviderId ? "Solicitação atendida" : ACTION_NOTES.accept;
  const patch = {
    ...(action === "accept" ? { acceptedAt: now } : {}),
    ...(claimProviderId ? { providerId: claimProviderId } : {}),
    ...(rule.to === "COMPLETED" ? { completedAt: now } : {}),
    ...(rule.to === "CANCELLED"
      ? { cancelledAt: now, cancelReason: note ?? ACTION_NOTES[action] }
      : {}),
  } as Json;

  const { error: rpcError } = await supabase.rpc("transition_order", {
    p_order_id: id,
    p_status: rule.to,
    p_patch: patch,
    p_event_note:
      note ?? completeNote ?? (action === "accept" ? acceptNote : ACTION_NOTES[action]),
  });
  if (rpcError) return { error: rpcError.message, status: 500 };

  if (action === "accept") {
    await supabase
      .from("order")
      .update({ doorCode: generateDoorCode(), doorCodeAttempts: 0 })
      .eq("id", id)
      .is("doorCode", null);
  }

  const updated = await fetchOrder(id);
  if (!updated) return { error: "Pedido não encontrado", status: 404 };

  if (rule.to === "COMPLETED" && updated.provider) {
    const pay = paymentFromEmbed(order.payment);
    if (pay?.method === "CASH") {
      await supabase
        .from("payment")
        .update({ status: "PAID", updatedAt: now })
        .eq("orderId", id);
    }
    const movement = completionWalletMovement(
      feeRuleOf(updated),
      updated,
      pay ? { method: pay.method, paid: pay.status === "PAID" } : null,
    );
    if (movement) await applyWalletMovement(updated.provider.userId, movement, updated.id);
  }
  if (rule.to === "CANCELLED") {
    await refundIfPaid(id);
    await releaseOrderDiscounts(id);
  }
  if (action === "start_work") void recordEtaMeasurement(id);
  const familyEvents: Partial<Record<OrderAction, FamilyEvent>> = {
    accept: "accept",
    start_route: "start_route",
    start_work: "start_work",
    complete: "complete",
  };
  const familyEvent = familyEvents[action];
  if (familyEvent) void notifyTrustedContact(id, familyEvent);

  const recipientId = rule.by === "provider" ? order.clientId : updated.provider?.userId;
  if (recipientId) {
    void notifyUser(recipientId, "ORDER", {
      title: updated.service?.name ?? updated.category?.name ?? updated.description ?? "Pedido",
      body: note ?? (action === "accept" ? acceptNote : ACTION_NOTES[action]),
      data: { type: "order", orderId: id, role: rule.by === "provider" ? "client" : "provider" },
    });
  }

  return withRoute(updated, toDTO(updated));
}

export type ArrangeOrderInput = {
  addressId?: string;
  pickupAddressId?: string | null;
  detailsReady?: boolean;
};

export async function arrangeOrder(
  id: string,
  clientId: string,
  input: ArrangeOrderInput,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await fetchOrder(id);
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  if (order.clientId !== clientId) return { error: "Ação permitida apenas ao cliente", status: 403 };
  if (!order.isOpenRequest) return { error: "Só solicitações abertas usam este passo", status: 400 };
  if (order.status !== "ACCEPTED" && order.status !== "EN_ROUTE") {
    return { error: "Só é possível combinar depois do aceite", status: 409 };
  }

  let addressId = order.addressId;
  if (input.addressId) {
    const { data: address } = await supabase
      .from("address")
      .select("*")
      .eq("id", input.addressId)
      .maybeSingle();
    if (!address || address.userId !== clientId) {
      return { error: "Endereço inválido", status: 400 };
    }
    addressId = address.id;
  }

  let pickupAddressId: string | null | undefined = undefined;
  if (input.pickupAddressId === null) {
    pickupAddressId = null;
  } else if (input.pickupAddressId) {
    if (input.pickupAddressId === addressId) {
      pickupAddressId = null;
    } else {
      const { data: pickup } = await supabase
        .from("address")
        .select("*")
        .eq("id", input.pickupAddressId)
        .maybeSingle();
      if (!pickup || pickup.userId !== clientId) {
        return { error: "Local de busca inválido", status: 400 };
      }
      pickupAddressId = pickup.id;
    }
  }

  const markReady = input.detailsReady === true;
  const now = new Date().toISOString();
  const update: Partial<OrderRow> = {
    addressId,
    updatedAt: now,
  };
  if (pickupAddressId !== undefined) update.pickupAddressId = pickupAddressId;
  if (markReady) update.detailsReady = true;

  const { error } = await supabase.from("order").update(update).eq("id", id);
  if (error) return { error: error.message, status: 500 };

  if (markReady) {
    await supabase.from("orderevent").insert({
      id: randomUUID(),
      orderId: id,
      status: order.status,
      note: input.pickupAddressId
        ? "Locais combinados"
        : "Cliente liberou o trajeto (detalhes no chat)",
    });
  }

  if (markReady && order.provider?.userId) {
    void notifyUser(order.provider.userId, "ORDER", {
      title: "Pode iniciar o trajeto",
      body: order.description?.trim() || "O cliente liberou os detalhes",
      data: { type: "order", orderId: id, role: "provider" },
    });
  }

  const updated = await fetchOrder(id);
  if (!updated) return { error: "Pedido não encontrado", status: 404 };
  return withRoute(updated, toDTO(updated));
}

export async function reassignOrder(
  id: string,
  clientId: string,
  providerId: string,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await fetchOrder(id);
  if (!order) return { error: "Chamada não encontrada", status: 404 };
  if (order.clientId !== clientId) return { error: "Ação permitida apenas ao cliente", status: 403 };
  if (order.status !== "CREATED") {
    return { error: "Só é possível trocar a pessoa enquanto a chamada está aberta", status: 409 };
  }
  if (order.isOpenRequest && !order.providerId) {
    return { error: "Solicitação aberta espera alguém atender — cancele para chamar uma pessoa", status: 409 };
  }
  if (order.providerId === providerId) return { error: "Essa já é a pessoa da chamada", status: 400 };

  const { data: provider } = await supabase
    .from("providerprofile")
    .select("*")
    .eq("id", providerId)
    .maybeSingle();
  if (!provider || provider.status !== "APPROVED" || !provider.isAvailable) {
    return { error: "Essa pessoa não está disponível agora", status: 400 };
  }
  const { data: busy } = await supabase
    .from("order")
    .select("id")
    .eq("providerId", provider.id)
    .in("status", [...BUSY_ORDER_STATUSES])
    .limit(1)
    .maybeSingle();
  if (busy) return { error: "Essa pessoa já está em uma chamada", status: 409 };

  const previousUserId = order.provider?.userId;
  const now = new Date().toISOString();
  await supabase
    .from("order")
    .update({ providerId: provider.id, createdAt: now, updatedAt: now })
    .eq("id", id);
  await supabase.from("orderevent").insert({
    id: randomUUID(),
    orderId: id,
    status: "CREATED",
    note: "Chamada reenviada para outra pessoa",
  });

  const updated = await fetchOrder(id);
  if (!updated) return { error: "Pedido não encontrado", status: 404 };

  if (previousUserId) {
    void notifyUser(previousUserId, "ORDER", {
      title: "Chamada encerrada",
      body: "O cliente chamou outra pessoa",
      data: { type: "order", orderId: id, role: "provider" },
    });
  }
  void notifyUser(provider.userId, "ORDER", {
    title: "Nova chamada",
    body: updated.service?.name ?? updated.category?.name ?? "Alguém está te chamando",
    data: { type: "order", orderId: id, role: "provider" },
  });

  return toDTO(updated);
}
