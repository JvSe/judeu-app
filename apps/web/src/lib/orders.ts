import type { OrderStatus, Prisma } from "@judeu/db";

import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Pedidos: criação, consulta e máquina de estados (coração do marketplace).
// ---------------------------------------------------------------------------

// Comissão da plataforma sobre o valor do serviço.
const PLATFORM_FEE_RATE = 0.08;

// Centro de Palmas/TO — fallback quando o endereço ainda não foi geocodificado
// (o geocoding real via Nominatim entra no incremento de cadastro de endereço).
const FALLBACK_LAT = -10.1841;
const FALLBACK_LNG = -48.3336;

export type OrderAction =
  | "accept"
  | "reject"
  | "start_route"
  | "start_work"
  | "complete"
  | "cancel";

// Transições permitidas: estado atual -> ação -> novo estado, com o papel que pode disparar.
const TRANSITIONS: Record<
  OrderAction,
  { from: OrderStatus[]; to: OrderStatus; by: "client" | "provider" }
> = {
  accept: { from: ["CREATED"], to: "ACCEPTED", by: "provider" },
  reject: { from: ["CREATED"], to: "CANCELLED", by: "provider" },
  start_route: { from: ["ACCEPTED"], to: "EN_ROUTE", by: "provider" },
  start_work: { from: ["EN_ROUTE"], to: "IN_PROGRESS", by: "provider" },
  complete: { from: ["IN_PROGRESS"], to: "COMPLETED", by: "provider" },
  cancel: { from: ["CREATED", "ACCEPTED"], to: "CANCELLED", by: "client" },
};

// Inclusão padrão para montar o DTO completo do pedido.
const orderInclude = {
  service: { select: { id: true, name: true, priceCents: true } },
  category: { select: { id: true, name: true } },
  address: true,
  provider: { include: { user: { select: { id: true, fullName: true } } } },
  client: { select: { id: true, fullName: true, phone: true } },
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
  service: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  provider: { id: string; name: string; headline: string | null; ratingAvg: number } | null;
  client: { id: string; name: string; phone: string | null };
  address: {
    label: string | null;
    street: string;
    number: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
  };
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
};

function toDTO(o: OrderRow): OrderDTO {
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
    service: o.service ? { id: o.service.id, name: o.service.name } : null,
    category: o.category ? { id: o.category.id, name: o.category.name } : null,
    provider: o.provider
      ? {
          id: o.provider.id,
          name: o.provider.user.fullName,
          headline: o.provider.headline,
          ratingAvg: o.provider.ratingAvg,
        }
      : null,
    client: { id: o.client.id, name: o.client.fullName, phone: o.client.phone },
    address: {
      label: o.address.label,
      street: o.address.street,
      number: o.address.number,
      neighborhood: o.address.neighborhood,
      city: o.address.city,
      state: o.address.state,
    },
    events: o.events.map((e) => ({
      status: e.status,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type CreateOrderInput = {
  providerId: string; // ProviderProfile.id
  serviceId?: string;
  categoryId?: string;
  description?: string;
  scheduledAt?: string; // ISO; ausente = "agora"
  address: {
    label?: string;
    cep?: string;
    street: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city: string;
    state: string;
    lat?: number;
    lng?: number;
  };
};

export async function createOrder(
  clientId: string,
  input: CreateOrderInput,
): Promise<OrderDTO | { error: string; status: number }> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: input.providerId },
    include: { services: true },
  });
  if (!provider || provider.status !== "APPROVED") {
    return { error: "Prestador indisponível", status: 400 };
  }

  // Preço vem do serviço escolhido (se houver) e precisa pertencer ao prestador.
  let priceCents = 0;
  let serviceId: string | undefined;
  if (input.serviceId) {
    const service = provider.services.find((s) => s.id === input.serviceId);
    if (!service) return { error: "Serviço não pertence ao prestador", status: 400 };
    priceCents = service.priceCents;
    serviceId = service.id;
  }
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  const totalCents = priceCents + platformFeeCents;

  const order = await prisma.order.create({
    data: {
      client: { connect: { id: clientId } },
      provider: { connect: { id: provider.id } },
      ...(serviceId ? { service: { connect: { id: serviceId } } } : {}),
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
      description: input.description,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      priceCents,
      platformFeeCents,
      totalCents,
      status: "CREATED",
      address: {
        create: {
          user: { connect: { id: clientId } },
          label: input.address.label,
          cep: input.address.cep,
          street: input.address.street,
          number: input.address.number,
          complement: input.address.complement,
          neighborhood: input.address.neighborhood,
          city: input.address.city,
          state: input.address.state,
          lat: input.address.lat ?? FALLBACK_LAT,
          lng: input.address.lng ?? FALLBACK_LNG,
        },
      },
      events: { create: { status: "CREATED", note: "Pedido criado" } },
    },
    include: orderInclude,
  });
  return toDTO(order);
}

export async function listClientOrders(clientId: string): Promise<OrderDTO[]> {
  const rows = await prisma.order.findMany({
    where: { clientId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

// Fila do prestador: pedidos direcionados ao seu perfil.
export async function listProviderOrders(userId: string): Promise<OrderDTO[]> {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) return [];
  const rows = await prisma.order.findMany({
    where: { providerId: profile.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function getOrder(id: string, userId: string): Promise<OrderDTO | null> {
  const o = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!o) return null;
  // Só o cliente do pedido ou o prestador designado enxergam.
  const isClient = o.clientId === userId;
  const isProvider = o.provider?.userId === userId;
  if (!isClient && !isProvider) return null;
  return toDTO(o);
}

const ACTION_NOTES: Record<OrderAction, string> = {
  accept: "Pedido aceito pelo prestador",
  reject: "Pedido recusado pelo prestador",
  start_route: "Prestador a caminho",
  start_work: "Serviço em execução",
  complete: "Serviço concluído",
  cancel: "Pedido cancelado pelo cliente",
};

export async function transitionOrder(
  id: string,
  userId: string,
  action: OrderAction,
  note?: string,
): Promise<OrderDTO | { error: string; status: number }> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { provider: { select: { userId: true } } },
  });
  if (!order) return { error: "Pedido não encontrado", status: 404 };

  const rule = TRANSITIONS[action];
  const isClient = order.clientId === userId;
  const isProvider = order.provider?.userId === userId;

  // Autorização por papel na transição.
  if (rule.by === "provider" && !isProvider) {
    return { error: "Ação permitida apenas ao prestador", status: 403 };
  }
  if (rule.by === "client" && !isClient) {
    return { error: "Ação permitida apenas ao cliente", status: 403 };
  }
  if (!rule.from.includes(order.status)) {
    return { error: `Transição inválida a partir de ${order.status}`, status: 409 };
  }

  const now = new Date();
  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: rule.to,
      ...(action === "accept" ? { acceptedAt: now } : {}),
      ...(rule.to === "COMPLETED" ? { completedAt: now } : {}),
      ...(rule.to === "CANCELLED"
        ? { cancelledAt: now, cancelReason: note ?? ACTION_NOTES[action] }
        : {}),
      events: { create: { status: rule.to, note: note ?? ACTION_NOTES[action] } },
    },
    include: orderInclude,
  });
  return toDTO(updated);
}
