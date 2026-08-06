import { prisma } from "./db";

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
  rating: number;
  reviews: number;
  yearsExperience: number;
  priceFromCents: number | null;
  baseLat: number | null;
  baseLng: number | null;
  isAvailable: boolean;
  allowsNegotiation: boolean;
};

// Empresa (isCompany=true) exibe o nome do responsável como referência ao cliente,
// em vez da razão social — o nome da empresa vira dado secundário (companyName).
function displayName(p: { isCompany: boolean; responsibleName: string | null; user: { fullName: string } }): string {
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
  isAvailable: boolean;
  allowsNegotiation: boolean;
  user: { fullName: string };
  services: { priceCents: number }[];
};

function toProviderListDTO(p: ProviderRow): ProviderListDTO {
  return {
    id: p.id,
    name: displayName(p),
    companyName: p.isCompany ? p.companyName : null,
    role: p.headline,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    yearsExperience: p.yearsExperience,
    priceFromCents: minPrice(p.services),
    baseLat: p.baseLat,
    baseLng: p.baseLng,
    isAvailable: p.isAvailable,
    allowsNegotiation: p.allowsNegotiation,
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
  return rows.map(toProviderListDTO);
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
    providers: providers.map(toProviderListDTO),
  };
}

export async function getProvider(id: string): Promise<ProviderDetailDTO | null> {
  const p = await prisma.providerProfile.findUnique({
    where: { id },
    include: { user: true, services: { orderBy: { priceCents: "asc" } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: displayName(p),
    companyName: p.isCompany ? p.companyName : null,
    role: p.headline,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    yearsExperience: p.yearsExperience,
    priceFromCents: minPrice(p.services),
    baseLat: p.baseLat,
    baseLng: p.baseLng,
    isAvailable: p.isAvailable,
    allowsNegotiation: p.allowsNegotiation,
    bio: p.bio,
    services: p.services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents })),
  };
}
