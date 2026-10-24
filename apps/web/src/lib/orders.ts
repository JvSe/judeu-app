import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@judeu/db";

import { effectiveProviderPosition } from "./catalog";
import { prisma } from "./db";
import { haversineKm, routeBetween } from "./geo";
import { notifyUser } from "./notifications";
import { creditProviderWallet, refundIfPaid } from "./payments";

// ---------------------------------------------------------------------------
// Pedidos: criação, consulta e máquina de estados (coração do marketplace).
// Dois modos:
// - contrato dirigido: cliente escolhe uma pessoa (mapa/categoria) e chama ela;
// - solicitação aberta: cliente publica o que precisa e alguém perto atende.
// ---------------------------------------------------------------------------

// Comissão da plataforma sobre o valor do serviço.
export const PLATFORM_FEE_RATE = 0.08;

// Centro de Palmas/TO — fallback quando o endereço ainda não foi geocodificado
// (o geocoding real via Nominatim entra no incremento de cadastro de endereço).
export const FALLBACK_LAT = -10.1841;
export const FALLBACK_LNG = -48.3336;

// Raio (linha reta) considerado "chegou" no destino atual, pra liberar o
// botão de iniciar serviço — não depende do Valhalla, que roda best-effort.
const ARRIVAL_RADIUS_KM = 0.15;
export const OFFER_TTL_MS = 60_000;
export const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;

export function isInsideServiceRadius(
  origin: { lat: number; lng: number } | null,
  radiusKm: number,
  point: { lat: number; lng: number },
): boolean {
  if (!origin) return false;
  return haversineKm(origin, point) <= radiusKm;
}

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

export type OrderAction =
  | "accept"
  | "reject"
  | "start_route"
  | "start_work"
  | "complete"
  | "confirm_completion"
  | "cancel";

// Transições permitidas: estado atual -> ação -> novo estado, com o papel que pode disparar.
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

// Inclusão padrão para montar o DTO completo do pedido.
const orderInclude = {
  service: { select: { id: true, name: true, priceCents: true } },
  category: { select: { id: true, name: true } },
  address: true,
  pickupAddress: true,
  provider: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
  client: { select: { id: true, fullName: true, phone: true } },
  events: { orderBy: { createdAt: "asc" } },
  payment: { select: { status: true, method: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
  client: { id: string; name: string; phone: string | null };
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

function toDTO(o: OrderRow, unreadMessages = 0): OrderDTO {
  const dest = trackingDestination(o);
  const openWait = o.isOpenRequest && !o.providerId && o.status === "CREATED";
  return {
    id: o.id,
    status: o.status,
    description: o.description,
    scheduledAt: o.scheduledAt?.toISOString() ?? null,
    priceCents: o.priceCents,
    platformFeeCents: o.platformFeeCents,
    totalCents: o.totalCents,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    offerExpiresAt: new Date(
      o.createdAt.getTime() + (openWait ? OPEN_REQUEST_TTL_MS : OFFER_TTL_MS),
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
    client: { id: o.client.id, name: o.client.fullName, phone: o.client.phone },
    payment: o.payment ? { status: o.payment.status, method: o.payment.method } : null,
    address: toAddressDTO(o.address),
    pickupAddress: o.pickupAddress ? toAddressDTO(o.pickupAddress) : null,
    events: o.events.map((e) => ({
      status: e.status,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    tracking: {
      providerLat: o.providerLat,
      providerLng: o.providerLng,
      updatedAt: o.providerLocationAt?.toISOString() ?? null,
      distanceKm: null,
      etaMin: null,
      route: null,
      arrived: hasArrivedAt(o.providerLat, o.providerLng, dest),
    },
  };
}

// Preenche distância/ETA reais (Valhalla) a partir da última posição do prestador.
// Best-effort: sem VALHALLA_URL configurada (Railway pendente) ou em caso de erro,
// mantém tracking.distanceKm/etaMin nulos em vez de derrubar a request.
const routeCache = new Map<string, { expiresAt: number; route: Awaited<ReturnType<typeof routeBetween>> }>();
const ROUTE_CACHE_TTL_MS = 20_000;

async function withRoute(order: OrderRow, dto: OrderDTO): Promise<OrderDTO> {
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
  const route = await routeBetween(
    { lat: order.providerLat, lng: order.providerLng },
    dest,
  );
  routeCache.set(cacheKey, { expiresAt: now + ROUTE_CACHE_TTL_MS, route });
  dto.tracking.distanceKm = route.distanceKm;
  dto.tracking.etaMin = route.durationMin;
  dto.tracking.route = route.points;
  return dto;
}

export type CreateOrderInput = {
  providerId?: string; // ausente = solicitação aberta
  serviceId?: string;
  categoryId?: string;
  description?: string;
  scheduledAt?: string; // ISO; ausente = "agora"
  addressId?: string; // obrigatório no contrato dirigido; na aberta usa o endereço padrão
  pickupAddressId?: string;
  priceCents?: number; // obrigatório na solicitação aberta
};

async function notifyAvailableProviders(order: OrderRow) {
  const rows = await prisma.providerProfile.findMany({
    where: {
      status: "APPROVED",
      isAvailable: true,
      userId: { not: order.clientId },
    },
    select: {
      userId: true,
      ordersAsProvider: {
        where: { status: { in: [...BUSY_ORDER_STATUSES] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const body = order.description?.trim() || order.category?.name || "Alguém precisa de ajuda";
  let sent = 0;
  for (const p of rows) {
    if (p.ordersAsProvider.length > 0) continue;
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
    const fallback = await prisma.address.findFirst({
      where: { userId: clientId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (!fallback) {
      return { error: "Cadastre um endereço no perfil para publicar o pedido", status: 400 };
    }
    addressId = fallback.id;
  }
  if (!addressId) return { error: "Endereço inválido", status: 400 };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== clientId) {
    return { error: "Endereço inválido", status: 400 };
  }

  let priceCents = 0;
  let serviceId: string | undefined;
  let provider: { id: string; userId: string; services: { id: string; priceCents: number }[] } | null =
    null;

  if (!isOpenRequest) {
    const found = await prisma.providerProfile.findUnique({
      where: { id: input.providerId },
      include: { services: true },
    });
    if (!found || found.status !== "APPROVED" || !found.isAvailable) {
      return { error: "Essa pessoa não está disponível agora", status: 400 };
    }
    const busy = await prisma.order.findFirst({
      where: { providerId: found.id, status: { in: [...BUSY_ORDER_STATUSES] } },
      select: { id: true },
    });
    if (busy) return { error: "Essa pessoa já está em uma chamada", status: 409 };
    provider = found;
    if (input.serviceId) {
      const service = found.services.find((s) => s.id === input.serviceId);
      if (!service) return { error: "Serviço não pertence ao prestador", status: 400 };
      priceCents = service.priceCents;
      serviceId = service.id;
    }
  } else {
    priceCents = input.priceCents!;
  }

  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  const totalCents = priceCents + platformFeeCents;

  const order = await prisma.order.create({
    data: {
      client: { connect: { id: clientId } },
      ...(provider ? { provider: { connect: { id: provider.id } } } : {}),
      ...(serviceId ? { service: { connect: { id: serviceId } } } : {}),
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      isOpenRequest,
      detailsReady: !isOpenRequest,
      description,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      priceCents,
      platformFeeCents,
      totalCents,
      status: "CREATED",
      address: { connect: { id: address.id } },
      events: {
        create: {
          status: "CREATED",
          note: isOpenRequest ? "Solicitação publicada" : "Chamada enviada",
        },
      },
    },
    include: orderInclude,
  });

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

// Conta mensagens não lidas (da outra parte) por pedido, pro badge de chat na listagem.
async function unreadMessageCounts(
  orderIds: string[],
  viewerId: string,
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await prisma.message.groupBy({
    by: ["orderId"],
    where: { orderId: { in: orderIds }, senderId: { not: viewerId }, readAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.orderId, r._count._all]));
}

export async function listClientOrders(clientId: string): Promise<OrderDTO[]> {
  const rows = await prisma.order.findMany({
    where: { clientId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  const unread = await unreadMessageCounts(
    rows.map((o) => o.id),
    clientId,
  );
  return rows.map((o) => toDTO(o, unread.get(o.id) ?? 0));
}

async function listNearbyOpenRequests(
  userId: string,
  profile: {
    serviceRadiusKm: number;
    lastLat: number | null;
    lastLng: number | null;
    lastLocationAt: Date | null;
    baseLat: number | null;
    baseLng: number | null;
  },
): Promise<OrderRow[]> {
  const origin = effectiveProviderPosition(profile);
  if (!origin) return [];
  const rows = await prisma.order.findMany({
    where: {
      isOpenRequest: true,
      providerId: null,
      status: "CREATED",
      clientId: { not: userId },
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows
    .filter((row) =>
      isInsideServiceRadius(origin, profile.serviceRadiusKm, {
        lat: row.address.lat,
        lng: row.address.lng,
      }),
    )
    .slice(0, 40);
}

// Fila do prestador: chamadas dirigidas a ele + solicitações abertas no raio.
export async function listProviderOrders(userId: string): Promise<OrderDTO[]> {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) return [];
  const [assigned, open] = await Promise.all([
    prisma.order.findMany({
      where: { providerId: profile.id },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    }),
    listNearbyOpenRequests(userId, profile),
  ]);
  const seen = new Set<string>();
  const rows: OrderRow[] = [];
  for (const row of [...open, ...assigned]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unread = await unreadMessageCounts(
    rows.map((o) => o.id),
    userId,
  );
  return rows.map((o) => toDTO(o, unread.get(o.id) ?? 0));
}

async function canViewOpenRequest(userId: string): Promise<boolean> {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { status: true },
  });
  return profile?.status === "APPROVED";
}

export async function getOrder(id: string, userId: string): Promise<OrderDTO | null> {
  const o = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!o) return null;
  const isClient = o.clientId === userId;
  const isProvider = o.provider?.userId === userId;
  const openPool = o.isOpenRequest && !o.providerId && o.status === "CREATED";
  if (!isClient && !isProvider) {
    if (!openPool || o.clientId === userId) return null;
    if (!(await canViewOpenRequest(userId))) return null;
  }
  const unreadMessages = await prisma.message.count({
    where: { orderId: id, senderId: { not: userId }, readAt: null },
  });
  return withRoute(o, toDTO(o, unreadMessages));
}

// Prestador reporta sua posição atual enquanto o pedido está a caminho (RF-E3).
export async function updateOrderLocation(
  id: string,
  userId: string,
  lat: number,
  lng: number,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { provider: { select: { userId: true } } },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  if (order.provider?.userId !== userId) {
    return { error: "Ação permitida apenas ao prestador do pedido", status: 403 };
  }
  if (order.status !== "ACCEPTED" && order.status !== "EN_ROUTE" && order.status !== "IN_PROGRESS") {
    return { error: "Pedido não está a caminho", status: 409 };
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { providerLat: lat, providerLng: lng, providerLocationAt: new Date() },
    include: orderInclude,
  });
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
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      provider: { select: { userId: true } },
      payment: true,
      address: true,
      pickupAddress: true,
    },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const rule = TRANSITIONS[action];
  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;
  const openUnclaimed = order.isOpenRequest && !order.providerId && order.status === "CREATED";

  let claimProviderId: string | null = null;

  if (action === "accept" && openUnclaimed) {
    if (isClient) return { error: "Você não pode atender a própria solicitação", status: 403 };
    const profile = await prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile || profile.status !== "APPROVED") {
      return { error: "Só quem está aprovado para atender pode pegar essa solicitação", status: 403 };
    }
    if (!profile.isAvailable) {
      return { error: "Fique disponível para atender solicitações", status: 409 };
    }
    const busy = await prisma.order.findFirst({
      where: { providerId: profile.id, status: { in: [...BUSY_ORDER_STATUSES] } },
      select: { id: true },
    });
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
    if (order.isOpenRequest && !order.detailsReady) {
      return { error: "Aguardando o cliente combinar os detalhes", status: 409 };
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

  const now = new Date();
  const acceptNote = claimProviderId ? "Solicitação atendida" : ACTION_NOTES.accept;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: rule.to,
      ...(action === "accept" ? { acceptedAt: now } : {}),
      ...(claimProviderId ? { provider: { connect: { id: claimProviderId } } } : {}),
      ...(rule.to === "COMPLETED" ? { completedAt: now } : {}),
      ...(rule.to === "CANCELLED"
        ? { cancelledAt: now, cancelReason: note ?? ACTION_NOTES[action] }
        : {}),
      events: {
        create: {
          status: rule.to,
          note: note ?? (action === "accept" ? acceptNote : ACTION_NOTES[action]),
        },
      },
    },
    include: orderInclude,
  });

  // Repasse ao prestador (ledger interno) na conclusão; dinheiro é "pago" na hora.
  // Só alcançável via confirm_completion agora — "complete" leva a AWAITING_CONFIRMATION.
  if (rule.to === "COMPLETED" && updated.provider) {
    if (order.payment?.method === "CASH") {
      await prisma.payment.update({ where: { orderId: id }, data: { status: "PAID" } });
    }
    if (order.payment?.method === "CASH" || order.payment?.status === "PAID") {
      await creditProviderWallet(updated.provider.userId, updated.priceCents, updated.id);
    }
  }
  // Estorna via Stripe se já havia pagamento capturado (Pix/cartão).
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

// Cliente define locais (opcional) ou marca que vai combinar no chat — libera o trajeto.
export async function arrangeOrder(
  id: string,
  clientId: string,
  input: ArrangeOrderInput,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { provider: { select: { userId: true } } },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 };
  if (order.clientId !== clientId) return { error: "Ação permitida apenas ao cliente", status: 403 };
  if (!order.isOpenRequest) return { error: "Só solicitações abertas usam este passo", status: 400 };
  if (order.status !== "ACCEPTED" && order.status !== "EN_ROUTE") {
    return { error: "Só é possível combinar depois do aceite", status: 409 };
  }

  let addressId = order.addressId;
  if (input.addressId) {
    const address = await prisma.address.findUnique({ where: { id: input.addressId } });
    if (!address || address.userId !== clientId) {
      return { error: "Endereço inválido", status: 400 };
    }
    addressId = address.id;
  }

  let pickupConnect: { connect: { id: string } } | { disconnect: true } | undefined;
  if (input.pickupAddressId === null) {
    pickupConnect = { disconnect: true };
  } else if (input.pickupAddressId) {
    if (input.pickupAddressId === addressId) {
      pickupConnect = { disconnect: true };
    } else {
      const pickup = await prisma.address.findUnique({ where: { id: input.pickupAddressId } });
      if (!pickup || pickup.userId !== clientId) {
        return { error: "Local de busca inválido", status: 400 };
      }
      pickupConnect = { connect: { id: pickup.id } };
    }
  }

  const markReady = input.detailsReady === true;
  const updated = await prisma.order.update({
    where: { id },
    data: {
      address: { connect: { id: addressId } },
      ...(pickupConnect ? { pickupAddress: pickupConnect } : {}),
      ...(markReady ? { detailsReady: true } : {}),
      ...(markReady
        ? {
            events: {
              create: {
                status: order.status,
                note: input.pickupAddressId
                  ? "Locais combinados"
                  : "Cliente liberou o trajeto (detalhes no chat)",
              },
            },
          }
        : {}),
    },
    include: orderInclude,
  });

  if (markReady && order.provider?.userId) {
    void notifyUser(order.provider.userId, "ORDER", {
      title: "Pode iniciar o trajeto",
      body: order.description?.trim() || "O cliente liberou os detalhes",
      data: { type: "order", orderId: id, role: "provider" },
    });
  }

  return withRoute(updated, toDTO(updated));
}

export async function reassignOrder(
  id: string,
  clientId: string,
  providerId: string,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { provider: { select: { userId: true } } },
  });
  if (!order) return { error: "Chamada não encontrada", status: 404 };
  if (order.clientId !== clientId) return { error: "Ação permitida apenas ao cliente", status: 403 };
  if (order.status !== "CREATED") return { error: "Só é possível trocar a pessoa enquanto a chamada está aberta", status: 409 };
  if (order.isOpenRequest && !order.providerId) {
    return { error: "Solicitação aberta espera alguém atender — cancele para chamar uma pessoa", status: 409 };
  }
  if (order.providerId === providerId) return { error: "Essa já é a pessoa da chamada", status: 400 };

  const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!provider || provider.status !== "APPROVED" || !provider.isAvailable) {
    return { error: "Essa pessoa não está disponível agora", status: 400 };
  }
  const busy = await prisma.order.findFirst({
    where: { providerId: provider.id, status: { in: [...BUSY_ORDER_STATUSES] } },
    select: { id: true },
  });
  if (busy) return { error: "Essa pessoa já está em uma chamada", status: 409 };

  const previousUserId = order.provider?.userId;
  const updated = await prisma.order.update({
    where: { id },
    data: {
      provider: { connect: { id: provider.id } },
      createdAt: new Date(),
      events: { create: { status: "CREATED", note: "Chamada reenviada para outra pessoa" } },
    },
    include: orderInclude,
  });

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
