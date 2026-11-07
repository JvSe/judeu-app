import { supabase } from "./db";
import { haversineKm, type LatLng } from "./geo";

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number;
  featured: boolean;
};

export type ProviderListDTO = {
  id: string;
  name: string;
  companyName: string | null;
  role: string | null;
  avatarUrl: string | null;
  rating: number;
  reviews: number;
  yearsExperience: number;
  priceFromCents: number | null;
  baseLat: number | null;
  baseLng: number | null;
  lastLat: number | null;
  lastLng: number | null;
  serviceRadiusKm: number;
  isAvailable: boolean;
  allowsNegotiation: boolean;
  distanceKm: number | null;
  etaMin: number | null;
};

export function displayName(p: {
  isCompany: boolean;
  responsibleName: string | null;
  user: { fullName: string };
}): string {
  return p.isCompany && p.responsibleName ? p.responsibleName : p.user.fullName;
}

export type ProviderDetailDTO = ProviderListDTO & {
  bio: string | null;
  services: { id: string; name: string; priceCents: number }[];
};

function toCategoryDTO(c: {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number;
}): CategoryDTO {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: c.count,
    featured: c.slug === "reparos",
  };
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const { data: rows, error } = await supabase.from("category").select("*").order("name");
  if (error) throw new Error(error.message);
  const { data: links } = await supabase.from("providercategory").select("categoryId");
  const counts = new Map<string, number>();
  for (const l of links ?? []) {
    counts.set(l.categoryId, (counts.get(l.categoryId) ?? 0) + 1);
  }
  return (rows ?? []).map((c) =>
    toCategoryDTO({ ...c, count: counts.get(c.id) ?? 0 }),
  );
}

function minPrice(services: { priceCents: number }[]): number | null {
  if (services.length === 0) return null;
  return services.reduce((min, s) => (s.priceCents < min ? s.priceCents : min), services[0].priceCents);
}

type ProviderRow = {
  id: string;
  isCompany: boolean;
  responsibleName: string | null;
  companyName: string | null;
  headline: string | null;
  bio?: string | null;
  ratingAvg: number;
  ratingCount: number;
  yearsExperience: number;
  baseLat: number | null;
  baseLng: number | null;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | Date | null;
  serviceRadiusKm: number;
  isAvailable: boolean;
  allowsNegotiation: boolean;
  user: { fullName: string; avatarUrl: string | null };
  services: { id?: string; name?: string; priceCents: number }[];
};

export const IDLE_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

export function effectiveProviderPosition(p: {
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: Date | string | null;
  baseLat: number | null;
  baseLng: number | null;
}): LatLng | null {
  const at =
    p.lastLocationAt == null
      ? null
      : typeof p.lastLocationAt === "string"
        ? new Date(p.lastLocationAt)
        : p.lastLocationAt;
  const live =
    p.lastLat != null &&
    p.lastLng != null &&
    at != null &&
    Date.now() - at.getTime() <= IDLE_LOCATION_MAX_AGE_MS;
  if (live) return { lat: p.lastLat as number, lng: p.lastLng as number };
  if (p.baseLat != null && p.baseLng != null) return { lat: p.baseLat, lng: p.baseLng };
  if (p.lastLat != null && p.lastLng != null) return { lat: p.lastLat, lng: p.lastLng };
  return null;
}

/**
 * Grade de ~550 m (0,005°) para posições expostas a qualquer usuário: o pin no
 * mapa continua perto, mas a localização exata/ao vivo de quem atende não vaza
 * (QA A-06/H-05). O acompanhamento do pedido usa order.tracking, que é exato.
 */
export const PUBLIC_POSITION_GRID_DEG = 0.005;

export function coarsen(value: number | null): number | null {
  if (value == null) return null;
  const snapped = Math.round(value / PUBLIC_POSITION_GRID_DEG) * PUBLIC_POSITION_GRID_DEG;
  return Number(snapped.toFixed(4));
}

export function etaMinFromKm(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 30) * 60));
}

function toProviderListDTO(
  p: ProviderRow,
  extras: { distanceKm?: number | null; etaMin?: number | null } = {},
): ProviderListDTO {
  const pos = effectiveProviderPosition(p);
  return {
    id: p.id,
    name: displayName(p),
    companyName: p.isCompany ? p.companyName : null,
    role: p.headline,
    avatarUrl: p.user.avatarUrl,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    yearsExperience: p.yearsExperience,
    priceFromCents: minPrice(p.services),
    baseLat: coarsen(p.baseLat),
    baseLng: coarsen(p.baseLng),
    lastLat: coarsen(pos?.lat ?? p.lastLat),
    lastLng: coarsen(pos?.lng ?? p.lastLng),
    serviceRadiusKm: p.serviceRadiusKm,
    isAvailable: p.isAvailable,
    allowsNegotiation: p.allowsNegotiation,
    distanceKm: extras.distanceKm ?? null,
    etaMin: extras.etaMin ?? null,
  };
}

const PROVIDER_SELECT = `
  *,
  user:user!inner(fullName, avatarUrl),
  services:service(id, name, priceCents)
`;

export async function listProviders(categoryId?: string): Promise<ProviderListDTO[]> {
  let q = supabase
    .from("providerprofile")
    .select(PROVIDER_SELECT)
    .eq("status", "APPROVED")
    .eq("isAvailable", true)
    .eq("isHelper", false)
    .order("ratingAvg", { ascending: false });

  if (categoryId) {
    const { data: links } = await supabase
      .from("providercategory")
      .select("providerId")
      .eq("categoryId", categoryId);
    const ids = (links ?? []).map((l) => l.providerId);
    if (ids.length === 0) return [];
    q = q.in("id", ids);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => toProviderListDTO(p as unknown as ProviderRow));
}

export type SearchResultDTO = {
  categories: CategoryDTO[];
  providers: ProviderListDTO[];
};

export async function searchCatalog(query: string): Promise<SearchResultDTO> {
  const q = query.trim();
  if (q.length < 2) return { categories: [], providers: [] };
  const pattern = `%${q}%`;

  const [{ data: categories }, { data: byUser }, { data: byCompany }, { data: byHeadline }, { data: catLinks }] =
    await Promise.all([
      supabase.from("category").select("*").ilike("name", pattern).order("name"),
      supabase
        .from("providerprofile")
        .select(PROVIDER_SELECT)
        .eq("status", "APPROVED")
        .eq("isAvailable", true)
        .eq("isHelper", false)
        .ilike("user.fullName", pattern),
      supabase
        .from("providerprofile")
        .select(PROVIDER_SELECT)
        .eq("status", "APPROVED")
        .eq("isAvailable", true)
        .eq("isHelper", false)
        .or(`companyName.ilike.${pattern},responsibleName.ilike.${pattern}`),
      supabase
        .from("providerprofile")
        .select(PROVIDER_SELECT)
        .eq("status", "APPROVED")
        .eq("isAvailable", true)
        .eq("isHelper", false)
        .ilike("headline", pattern),
      supabase
        .from("providercategory")
        .select("providerId, category:category!inner(name)")
        .ilike("category.name", pattern),
    ]);

  const { data: links } = await supabase.from("providercategory").select("categoryId");
  const counts = new Map<string, number>();
  for (const l of links ?? []) {
    counts.set(l.categoryId, (counts.get(l.categoryId) ?? 0) + 1);
  }

  const providerIdsFromCat = [...new Set((catLinks ?? []).map((l) => l.providerId))];
  let byCatProviders: unknown[] = [];
  if (providerIdsFromCat.length > 0) {
    const { data } = await supabase
      .from("providerprofile")
      .select(PROVIDER_SELECT)
      .eq("status", "APPROVED")
      .eq("isAvailable", true)
      .eq("isHelper", false)
      .in("id", providerIdsFromCat);
    byCatProviders = data ?? [];
  }

  const map = new Map<string, ProviderRow>();
  for (const p of [...(byUser ?? []), ...(byCompany ?? []), ...(byHeadline ?? []), ...byCatProviders]) {
    const row = p as unknown as ProviderRow;
    map.set(row.id, row);
  }

  return {
    categories: (categories ?? []).map((c) =>
      toCategoryDTO({ ...c, count: counts.get(c.id) ?? 0 }),
    ),
    providers: [...map.values()]
      .sort((a, b) => b.ratingAvg - a.ratingAvg)
      .map((p) => toProviderListDTO(p)),
  };
}

export async function getProvider(id: string): Promise<ProviderDetailDTO | null> {
  const { data: p } = await supabase
    .from("providerprofile")
    .select(PROVIDER_SELECT)
    .eq("id", id)
    // Perfil pendente/bloqueado ou de helper não é público (QA P-06, C-18).
    .eq("status", "APPROVED")
    .eq("isHelper", false)
    .maybeSingle();
  if (!p) return null;
  const row = p as unknown as ProviderRow;
  const services = [...row.services].sort((a, b) => a.priceCents - b.priceCents);
  return {
    ...toProviderListDTO({ ...row, services }),
    bio: row.bio ?? null,
    services: services.map((s) => ({
      id: s.id!,
      name: s.name!,
      priceCents: s.priceCents,
    })),
  };
}

const BUSY_ORDER_STATUSES = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "AWAITING_CONFIRMATION"] as const;

export type NearbyQuery = {
  lat: number;
  lng: number;
  categoryId?: string;
  excludeProviderId?: string;
};

export async function listNearbyProviders(query: NearbyQuery): Promise<ProviderListDTO[]> {
  const origin: LatLng = { lat: query.lat, lng: query.lng };
  let providerIds: string[] | null = null;
  if (query.categoryId) {
    const { data: links } = await supabase
      .from("providercategory")
      .select("providerId")
      .eq("categoryId", query.categoryId);
    providerIds = (links ?? []).map((l) => l.providerId);
    if (providerIds.length === 0) return [];
  }

  let q = supabase
    .from("providerprofile")
    .select(PROVIDER_SELECT)
    .eq("status", "APPROVED")
    .eq("isAvailable", true)
    .eq("isHelper", false);
  if (providerIds) q = q.in("id", providerIds);
  if (query.excludeProviderId) q = q.neq("id", query.excludeProviderId);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const { data: busy } = await supabase
    .from("order")
    .select("providerId")
    .in("status", [...BUSY_ORDER_STATUSES])
    .not("providerId", "is", null);
  const busyIds = new Set((busy ?? []).map((o) => o.providerId).filter(Boolean) as string[]);

  return (rows ?? [])
    .map((raw) => {
      const p = raw as unknown as ProviderRow;
      if (busyIds.has(p.id)) return null;
      const pos = effectiveProviderPosition(p);
      if (!pos) return null;
      const distanceKm = haversineKm(origin, pos);
      if (distanceKm > p.serviceRadiusKm) return null;
      return toProviderListDTO(p, { distanceKm, etaMin: etaMinFromKm(distanceKm) });
    })
    .filter((p): p is ProviderListDTO => p != null)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}
