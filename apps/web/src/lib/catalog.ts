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
  role: string | null;
  rating: number;
  reviews: number;
  yearsExperience: number;
  priceFromCents: number | null;
  baseLat: number | null;
  baseLng: number | null;
};

export type ProviderDetailDTO = ProviderListDTO & {
  bio: string | null;
  services: { id: string; name: string; priceCents: number }[];
};

export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { providers: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: c._count.providers,
    featured: c.slug === "reparos",
  }));
}

function minPrice(services: { priceCents: number }[]): number | null {
  if (services.length === 0) return null;
  return services.reduce((min, s) => (s.priceCents < min ? s.priceCents : min), services[0].priceCents);
}

export async function listProviders(categoryId?: string): Promise<ProviderListDTO[]> {
  const rows = await prisma.providerProfile.findMany({
    where: {
      status: "APPROVED",
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
    },
    include: { user: true, services: true },
    orderBy: { ratingAvg: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.user.fullName,
    role: p.headline,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    yearsExperience: p.yearsExperience,
    priceFromCents: minPrice(p.services),
    baseLat: p.baseLat,
    baseLng: p.baseLng,
  }));
}

export async function getProvider(id: string): Promise<ProviderDetailDTO | null> {
  const p = await prisma.providerProfile.findUnique({
    where: { id },
    include: { user: true, services: { orderBy: { priceCents: "asc" } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.user.fullName,
    role: p.headline,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    yearsExperience: p.yearsExperience,
    priceFromCents: minPrice(p.services),
    baseLat: p.baseLat,
    baseLng: p.baseLng,
    bio: p.bio,
    services: p.services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents })),
  };
}
