import { prisma } from "./db";
import { haversineKm, type LatLng } from "./geo";

// Serializadores do catálogo (categorias + prestadores) para o app.

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number; // nº de prestadores na categoria
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

// Empresa (isCompany=true) exibe o nome do responsável como referência ao cliente,
// em vez da razão social — o nome da empresa vira dado secundário (companyName).
export function displayName(p: { isCompany: boolean; responsibleName: string | null; user: { fullName: string } }): string {
  return p.isCompany && p.responsibleName ? p.responsibleName : p.user.fullName;
}

export type ProviderDetailDTO = ProviderListDTO & {
  bio: string | null;
  services: { id: string; name: string; priceCents: number }[];
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  _count: { providers: number };
};

function toCategoryDTO(c: CategoryRow): CategoryDTO {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: c._count.providers,
    featured: c.slug === "reparos",
  };
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { providers: true } } },
  });
  return rows.map(toCategoryDTO);
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
  ratingAvg: number;
  ratingCount: number;
  yearsExperience: number;
  baseLat: number | null;
  baseLng: number | null;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: Date | null;
  serviceRadiusKm: number;
  isAvailable: boolean;
  allowsNegotiation: boolean;
  user: { fullName: string; avatarUrl: string | null };
  services: { priceCents: number }[];
};

export const IDLE_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

export function effectiveProviderPosition(p: {
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: Date | null;
  baseLat: number | null;
  baseLng: number | null;
}): LatLng | null {
  const live =
    p.lastLat != null &&
    p.lastLng != null &&
    p.lastLocationAt != null &&
    Date.now() - p.lastLocationAt.getTime() <= IDLE_LOCATION_MAX_AGE_MS;
  if (live) return { lat: p.lastLat as number, lng: p.lastLng as number };
  if (p.baseLat != null && p.baseLng != null) return { lat: p.baseLat, lng: p.baseLng };
  if (p.lastLat != null && p.lastLng != null) return { lat: p.lastLat, lng: p.lastLng };
  return null;
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
    baseLat: p.baseLat,
    baseLng: p.baseLng,
    lastLat: pos?.lat ?? p.lastLat,
    lastLng: pos?.lng ?? p.lastLng,
    serviceRadiusKm: p.serviceRadiusKm,
    isAvailable: p.isAvailable,
    allowsNegotiation: p.allowsNegotiation,
    distanceKm: extras.distanceKm ?? null,
    etaMin: extras.etaMin ?? null,
  };
}

export async function listProviders(categoryId?: string): Promise<ProviderListDTO[]> {
  const rows = await prisma.providerProfile.findMany({
    where: {
      status: "APPROVED",
      isAvailable: true,
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
    },
    include: { user: true, services: true },
    orderBy: { ratingAvg: "desc" },
  });
  return rows.map((p) => toProviderListDTO(p));
}

export type SearchResultDTO = {
  categories: CategoryDTO[];
  providers: ProviderListDTO[];
};

// Busca única da aba Buscar: casa o termo com categorias (nome) e com prestadores —
// autônomos pelo nome do usuário, empresas por razão social/responsável, ambos por
// especialidade (headline) e pelo nome das categorias que atendem.
export async function searchCatalog(query: string): Promise<SearchResultDTO> {
  const q = query.trim();
  if (q.length < 2) return { categories: [], providers: [] };

  const match = { contains: q, mode: "insensitive" } as const;
  const [categories, providers] = await Promise.all([
    prisma.category.findMany({
      where: { name: match },
      orderBy: { name: "asc" },
      include: { _count: { select: { providers: true } } },
    }),
    prisma.providerProfile.findMany({
      where: {
        status: "APPROVED",
        isAvailable: true,
        OR: [
          { user: { fullName: match } },
          { companyName: match },
          { responsibleName: match },
          { headline: match },
          { categories: { some: { category: { name: match } } } },
        ],
      },
      include: { user: true, services: true },
      orderBy: { ratingAvg: "desc" },
    }),
  ]);

  return {
    categories: categories.map(toCategoryDTO),
    providers: providers.map((p) => toProviderListDTO(p)),
  };
}

export async function getProvider(id: string): Promise<ProviderDetailDTO | null> {
  const p = await prisma.providerProfile.findUnique({
    where: { id },
    include: { user: true, services: { orderBy: { priceCents: "asc" } } },
  });
  if (!p) return null;
  return {
    ...toProviderListDTO(p),
    bio: p.bio,
    services: p.services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents })),
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
  const rows = await prisma.providerProfile.findMany({
    where: {
      status: "APPROVED",
      isAvailable: true,
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.excludeProviderId ? { id: { not: query.excludeProviderId } } : {}),
    },
    include: {
      user: true,
      services: true,
      ordersAsProvider: {
        where: { status: { in: [...BUSY_ORDER_STATUSES] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return rows
    .filter((p) => p.ordersAsProvider.length === 0)
    .map((p) => {
      const pos = effectiveProviderPosition(p);
      if (!pos) return null;
      const distanceKm = haversineKm(origin, pos);
      if (distanceKm > p.serviceRadiusKm) return null;
      return toProviderListDTO(p, { distanceKm, etaMin: etaMinFromKm(distanceKm) });
    })
    .filter((p): p is ProviderListDTO => p != null)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}
