import { EXPIRY_NOTES } from "./cron/expire-orders";
import { ensureUtcIso } from "./dates";
import { supabase } from "./db";
import { median } from "./pricing";

// Métricas do piloto (meta do dia 90: % de ajudas aceitas em < 10 min por
// bairro, recompra em 30 dias, incidentes). Calculadas a partir dos dados
// brutos de Order/SupportTicket — no volume do piloto cabe em memória.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const ACCEPT_TARGET_MIN = 10;
const UNKNOWN_NEIGHBORHOOD = "Sem bairro";

export type MetricsOrder = {
  id: string;
  clientId: string;
  isOpenRequest: boolean;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  platformFeeCents: number;
  totalCents: number;
  neighborhood: string | null;
  categoryName: string | null;
};

const ms = (iso: string) => new Date(ensureUtcIso(iso)).getTime();

export type AcceptanceRow = { key: string; total: number; under10: number; rate: number | null };

export type AcceptanceStats = {
  /** Ajudas que já tiveram chance de ser aceitas em 10 min. */
  eligible: number;
  accepted: number;
  under10: number;
  rateUnder10: number | null;
  medianMinutesToAccept: number | null;
  byNeighborhood: AcceptanceRow[];
};

/**
 * % de ajudas abertas aceitas em menos de 10 min. Pedido ainda no ar com menos
 * de 10 min não entra no denominador (ainda pode bater a meta).
 */
export function acceptanceStats(orders: MetricsOrder[], now: Date): AcceptanceStats {
  const open = orders.filter((o) => o.isOpenRequest);
  const eligible = open.filter(
    (o) => o.acceptedAt || o.status !== "CREATED" || now.getTime() - ms(o.createdAt) >= ACCEPT_TARGET_MIN * MINUTE,
  );
  const minutes = (o: MetricsOrder) => (ms(o.acceptedAt!) - ms(o.createdAt)) / MINUTE;
  const accepted = eligible.filter((o) => o.acceptedAt);
  const fast = (o: MetricsOrder) => !!o.acceptedAt && minutes(o) < ACCEPT_TARGET_MIN;

  const groups = new Map<string, { total: number; under10: number }>();
  for (const o of eligible) {
    const key = o.neighborhood?.trim() || UNKNOWN_NEIGHBORHOOD;
    const g = groups.get(key) ?? { total: 0, under10: 0 };
    g.total += 1;
    if (fast(o)) g.under10 += 1;
    groups.set(key, g);
  }

  const under10 = eligible.filter(fast).length;
  return {
    eligible: eligible.length,
    accepted: accepted.length,
    under10,
    rateUnder10: eligible.length ? under10 / eligible.length : null,
    medianMinutesToAccept: (() => {
      const m = median(accepted.map((o) => Math.round(minutes(o) * 10)));
      return m == null ? null : m / 10;
    })(),
    byNeighborhood: [...groups.entries()]
      .map(([key, g]) => ({ key, ...g, rate: g.total ? g.under10 / g.total : null }))
      .sort((a, b) => b.total - a.total),
  };
}

export type Funnel = {
  created: number;
  accepted: number;
  completed: number;
  cancelled: number;
  expired: number;
  /** Receita da plataforma nos concluídos. */
  platformRevenueCents: number;
  /** Valor transacionado (GMV) nos concluídos. */
  gmvCents: number;
};

const EXPIRED_REASONS = new Set(Object.values(EXPIRY_NOTES));

export function funnel(orders: MetricsOrder[]): Funnel {
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  return {
    created: orders.length,
    accepted: orders.filter((o) => o.acceptedAt).length,
    completed: completed.length,
    cancelled: cancelled.length,
    expired: cancelled.filter((o) => o.cancelReason && EXPIRED_REASONS.has(o.cancelReason)).length,
    platformRevenueCents: completed.reduce((s, o) => s + o.platformFeeCents, 0),
    gmvCents: completed.reduce((s, o) => s + o.totalCents, 0),
  };
}

export type Repurchase = { cohort: number; repurchased: number; rate: number | null };

/**
 * Recompra em 30 dias: clientes cuja PRIMEIRA conclusão caiu no período e já
 * tem 30 dias de janela; quantos criaram outro pedido nos 30 dias seguintes.
 */
export function repurchase30d(
  history: Pick<MetricsOrder, "clientId" | "createdAt" | "completedAt" | "status">[],
  from: Date,
  now: Date,
): Repurchase {
  const byClient = new Map<string, typeof history>();
  for (const o of history) {
    const list = byClient.get(o.clientId) ?? [];
    list.push(o);
    byClient.set(o.clientId, list);
  }
  let cohort = 0;
  let repurchased = 0;
  for (const orders of byClient.values()) {
    const completions = orders
      .filter((o) => o.status === "COMPLETED" && o.completedAt)
      .map((o) => ms(o.completedAt!))
      .sort((a, b) => a - b);
    const first = completions[0];
    if (first == null || first < from.getTime() || first > now.getTime() - 30 * DAY) continue;
    cohort += 1;
    if (orders.some((o) => ms(o.createdAt) > first && ms(o.createdAt) <= first + 30 * DAY)) {
      repurchased += 1;
    }
  }
  return { cohort, repurchased, rate: cohort ? repurchased / cohort : null };
}

/** Limites do pitch para migrar para Google (Routes / Geocoding). */
export const ETA_ERROR_TRIGGER = 0.2;
export const GEOCODE_FAILURE_TRIGGER = 0.03;

export type EtaStats = { samples: number; medianErrorRatio: number | null; shareOver20: number | null };

export function etaStats(measurements: { errorRatio: number }[]): EtaStats {
  const ratios = measurements.map((m) => m.errorRatio).filter((r) => Number.isFinite(r));
  if (ratios.length === 0) return { samples: 0, medianErrorRatio: null, shareOver20: null };
  const m = median(ratios.map((r) => Math.round(r * 1000)));
  return {
    samples: ratios.length,
    medianErrorRatio: m == null ? null : m / 1000,
    shareOver20: ratios.filter((r) => r > ETA_ERROR_TRIGGER).length / ratios.length,
  };
}

export type GeocodeStats = { attempts: number; failures: number; failureRate: number | null };

export function geocodeStats(results: { ok: boolean }[]): GeocodeStats {
  const failures = results.filter((r) => !r.ok).length;
  return {
    attempts: results.length,
    failures,
    failureRate: results.length ? failures / results.length : null,
  };
}

export type MetricsReport = {
  from: string;
  to: string;
  acceptance: AcceptanceStats;
  funnel: Funnel;
  repurchase: Repurchase;
  incidents: { category: string; count: number }[];
  byChannel: { channel: string; newClients: number }[];
  eta: EtaStats;
  geocode: GeocodeStats;
};

type OrderQueryRow = Omit<MetricsOrder, "neighborhood" | "categoryName"> & {
  address: { neighborhood: string | null } | { neighborhood: string | null }[] | null;
  category: { name: string } | { name: string }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function loadMetricsReport(days: number, now = new Date()): Promise<MetricsReport> {
  const from = new Date(now.getTime() - days * DAY);
  const fromIso = from.toISOString();

  const [ordersRes, historyRes, ticketsRes, usersRes, eventsRes] = await Promise.all([
    supabase
      .from("order")
      .select(
        "id, clientId, isOpenRequest, status, createdAt, acceptedAt, completedAt, cancelReason, platformFeeCents, totalCents, address:address!order_addressId_fkey(neighborhood), category:category(name)",
      )
      .gte("createdAt", fromIso)
      .limit(10_000),
    supabase
      .from("order")
      .select("clientId, createdAt, completedAt, status")
      .gte("createdAt", new Date(from.getTime() - 30 * DAY).toISOString())
      .limit(20_000),
    supabase.from("supportticket").select("category").gte("createdAt", fromIso).limit(5_000),
    supabase.from("user").select("acquisitionChannel").gte("createdAt", fromIso).limit(10_000),
    supabase
      .from("appevent")
      .select("type, props")
      .in("type", ["order.eta_measured", "geocode.result"])
      .gte("createdAt", fromIso)
      .limit(20_000),
  ]);
  const events = (eventsRes.data ?? []) as { type: string; props: Record<string, unknown> | null }[];
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const orders: MetricsOrder[] = ((ordersRes.data ?? []) as unknown as OrderQueryRow[]).map((o) => ({
    ...o,
    neighborhood: one(o.address)?.neighborhood ?? null,
    categoryName: one(o.category)?.name ?? null,
  }));

  const incidents = new Map<string, number>();
  for (const t of ticketsRes.data ?? []) incidents.set(t.category, (incidents.get(t.category) ?? 0) + 1);

  const channels = new Map<string, number>();
  for (const u of (usersRes.data ?? []) as { acquisitionChannel: string | null }[]) {
    const key = u.acquisitionChannel || "não informado";
    channels.set(key, (channels.get(key) ?? 0) + 1);
  }

  return {
    from: fromIso,
    to: now.toISOString(),
    acceptance: acceptanceStats(orders, now),
    funnel: funnel(orders),
    repurchase: repurchase30d(historyRes.data ?? [], from, now),
    incidents: [...incidents.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byChannel: [...channels.entries()]
      .map(([channel, newClients]) => ({ channel, newClients }))
      .sort((a, b) => b.newClients - a.newClients),
    eta: etaStats(
      events
        .filter((e) => e.type === "order.eta_measured")
        .map((e) => ({ errorRatio: Number(e.props?.errorRatio) })),
    ),
    geocode: geocodeStats(
      events.filter((e) => e.type === "geocode.result").map((e) => ({ ok: e.props?.ok === true })),
    ),
  };
}
