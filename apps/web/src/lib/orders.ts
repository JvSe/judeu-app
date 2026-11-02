import { randomUUID } from "node:crypto";

import type { Json, OrderRow, OrderStatus, PaymentMethod, PaymentStatus } from "@judeu/db";

import { effectiveProviderPosition } from "./catalog";
import { supabase } from "./db";
import { haversineKm, routeBetween } from "./geo";
import { notifyUser } from "./notifications";
import { creditProviderWallet, refundIfPaid } from "./payments";
import { batchClientStats } from "./profile";

export const PLATFORM_FEE_RATE = 0.08;
export const FALLBACK_LAT = -10.1841;
export const FALLBACK_LNG = -48.3336;
const ARRIVAL_RADIUS_KM = 0.15;
export const OFFER_TTL_MS = 60_000;
export const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;
const OPEN_REQUEST_MIN_CHARS = 8;
const OPEN_NOTIFY_LIMIT = 100;
const BUSY_ORDER_STATUSES = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"] as const;

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
  payment: { status: PaymentStatus; method: PaymentMethod } | null;
};

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
  const createdAtMs = new Date(o.createdAt).getTime();
  return {
    id: o.id,
    status: o.status,
    description: o.description,
    scheduledAt: o.scheduledAt,
    priceCents: o.priceCents,
    platformFeeCents: o.platformFeeCents,
    totalCents: o.totalCents,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    offerExpiresAt: new Date(
      createdAtMs + (openWait ? OPEN_REQUEST_TTL_MS : OFFER_TTL_MS),
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
    payment: o.payment ? { status: o.payment.status, method: o.payment.method } : null,
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

export type CreateOrderInput = {
  providerId?: string;
  serviceId?: string;
  categoryId?: string;
  description?: string;
  scheduledAt?: string;
  addressId?: string;
  pickupAddressId?: string;
  priceCents?: number;
};

async function notifyAvailableProviders(order: OrderFull) {
  const { data: rows } = await supabase
    .from("providerprofile")
    .select("id, userId")
    .eq("status", "APPROVED")
    .eq("isAvailable", true)
    .neq("userId", order.clientId);

  const { data: busy } = await supabase
    .from("order")
    .select("providerId")
    .in("status", [...BUSY_ORDER_STATUSES])
    .not("providerId", "is", null);
  const busyIds = new Set((busy ?? []).map((o) => o.providerId).filter(Boolean));

  const body = order.description?.trim() || order.category?.name || "Alguém precisa de ajuda";
  let sent = 0;
  for (const p of rows ?? []) {
    if (busyIds.has(p.id)) continue;
    void notifyUser(p.userId, "ORDER", {
      title: "Nova solicitação",
      body,
      data: { type: "order", orderId: order.id, role: "provider" },
    });
    sent += 1;
    if (sent >= OPEN_NOTIFY_LIMIT) break;
  }
}

export async function createOrder(
  clientId: string,
  input: CreateOrderInput,
): Promise<OrderDTO | { error: string; status: number }> {
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

  let priceCents = 0;
  let serviceId: string | undefined;
  type ProviderPick = { id: string; userId: string; services: { id: string; priceCents: number }[] };
  let provider: ProviderPick | null = null;

  if (!isOpenRequest) {
    const { data: found } = await supabase
      .from("providerprofile")
      .select("*, services:service(id, priceCents)")
      .eq("id", input.providerId!)
      .maybeSingle();
    if (!found || found.status !== "APPROVED" || !found.isAvailable) {
      return { error: "Essa pessoa não está disponível agora", status: 400 };
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
    }
  } else {
    priceCents = input.priceCents!;
  }

  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  const totalCents = priceCents + platformFeeCents;
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
      status: "CREATED",
    } as Json,
    p_event_note: isOpenRequest ? "Solicitação publicada" : "Chamada enviada",
  });
  if (error || !created) return { error: error?.message ?? "Falha ao criar pedido", status: 500 };

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
  const list = (rows ?? []) as unknown as OrderFull[];
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
  const minCreatedAt = new Date(Date.now() - OPEN_REQUEST_TTL_MS).toISOString();
  const { data: rows } = await supabase
    .from("order")
    .select(ORDER_SELECT)
    .eq("isOpenRequest", true)
    .is("providerId", null)
    .eq("status", "CREATED")
    .neq("clientId", userId)
    .gte("createdAt", minCreatedAt)
    .order("createdAt", { ascending: false })
    .limit(200);
  return ((rows ?? []) as unknown as OrderFull[])
    .filter((row) =>
      isInsideServiceRadius(origin, profile.serviceRadiusKm, {
        lat: row.address.lat,
        lng: row.address.lng,
      }),
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

  const [{ data: assigned }, open] = await Promise.all([
    supabase
      .from("order")
      .select(ORDER_SELECT)
      .eq("providerId", profile.id)
      .order("createdAt", { ascending: false }),
    listNearbyOpenRequests(userId, profile),
  ]);

  const seen = new Set<string>();
  const rows: OrderFull[] = [];
  for (const row of [...open, ...((assigned ?? []) as unknown as OrderFull[])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = await unreadMessageCounts(
    rows.map((o) => o.id),
    userId,
  );
  return withOpenRequestClientStats(rows.map((o) => toDTO(o, unread.get(o.id) ?? 0)));
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
  const o = await fetchOrder(id);
  if (!o) return null;
  const isClient = o.clientId === userId;
  const isProvider = o.provider?.userId === userId;
  const openPool = o.isOpenRequest && !o.providerId && o.status === "CREATED";
  if (!isClient && !isProvider) {
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
  return enriched ?? dto;
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
  return withRoute(updated, toDTO(updated));
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

export async function transitionOrder(
  id: string,
  userId: string,
  action: OrderAction,
  note?: string,
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
    const { data: busy } = await supabase
      .from("order")
      .select("id")
      .eq("providerId", profile.id)
      .in("status", [...BUSY_ORDER_STATUSES])
      .limit(1)
      .maybeSingle();
    if (busy) return { error: "Você já está em uma chamada", status: 409 };
    claimProviderId = profile.id;
  } else if (rule.by === "provider" && !isProvider) {
    return { error: "Ação permitida apenas ao prestador", status: 403 };
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
    const paid = order.payment?.status === "PAID" || order.payment?.method === "CASH";
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
    p_event_note: note ?? (action === "accept" ? acceptNote : ACTION_NOTES[action]),
  });
  if (rpcError) return { error: rpcError.message, status: 500 };

  const updated = await fetchOrder(id);
  if (!updated) return { error: "Pedido não encontrado", status: 404 };

  if (rule.to === "COMPLETED" && updated.provider) {
    if (order.payment?.method === "CASH") {
      await supabase
        .from("payment")
        .update({ status: "PAID", updatedAt: now })
        .eq("orderId", id);
    }
    if (order.payment?.method === "CASH" || order.payment?.status === "PAID") {
      await creditProviderWallet(updated.provider.userId, updated.priceCents, updated.id);
    }
  }
  if (rule.to === "CANCELLED") {
    await refundIfPaid(id);
  }

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
