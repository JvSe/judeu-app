import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

// Seed de desenvolvimento: popula categorias + prestadores de exemplo em Palmas/TO.
// Idempotente. Bloqueado em produção.

const CATEGORIES = [
  { slug: "reparos", name: "Reparos", icon: "flash" },
  { slug: "limpeza", name: "Limpeza", icon: "sparkles" },
  { slug: "frete", name: "Frete", icon: "cube" },
  { slug: "beleza", name: "Beleza", icon: "cut" },
];

const PROVIDERS = [
  {
    email: "carlos.mendes@ajuda.app",
    name: "Carlos Mendes",
    role: "Eletricista",
    rating: 4.9,
    reviews: 328,
    years: 8,
    lat: -10.1849,
    lng: -48.3336,
    category: "reparos",
    services: [
      { name: "Instalação de tomada", priceCents: 8000 },
      { name: "Troca de chuveiro", priceCents: 12000 },
      { name: "Diagnóstico elétrico", priceCents: 6000 },
    ],
  },
  {
    email: "marina.lopes@ajuda.app",
    name: "Marina Lopes",
    role: "Diarista",
    rating: 4.8,
    reviews: 214,
    years: 5,
    lat: -10.1725,
    lng: -48.3301,
    category: "limpeza",
    services: [
      { name: "Limpeza padrão", priceCents: 12000 },
      { name: "Limpeza pesada", priceCents: 18000 },
    ],
  },
  {
    email: "rafael.souza@ajuda.app",
    name: "Rafael Souza",
    role: "Encanador",
    rating: 4.7,
    reviews: 156,
    years: 6,
    lat: -10.1968,
    lng: -48.3389,
    category: "reparos",
    services: [{ name: "Reparo de vazamento", priceCents: 9000 }],
  },
];

export function OPTIONS() {
  return handleOptions();
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return error("Seed desabilitado em produção", 403);
  }

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon },
      create: c,
    });
  }

  const passwordHash = await hashPassword("provider-demo-1234");

  for (const p of PROVIDERS) {
    const category = await prisma.category.findUnique({ where: { slug: p.category } });
    if (!category) continue;

    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { fullName: p.name, role: "PROVIDER" },
      create: { email: p.email, fullName: p.name, role: "PROVIDER", passwordHash },
    });

    const profile = await prisma.providerProfile.upsert({
      where: { userId: user.id },
      update: {
        headline: p.role,
        yearsExperience: p.years,
        status: "APPROVED",
        isAvailable: true,
        ratingAvg: p.rating,
        ratingCount: p.reviews,
        baseLat: p.lat,
        baseLng: p.lng,
      },
      create: {
        userId: user.id,
        headline: p.role,
        yearsExperience: p.years,
        status: "APPROVED",
        isAvailable: true,
        ratingAvg: p.rating,
        ratingCount: p.reviews,
        baseLat: p.lat,
        baseLng: p.lng,
      },
    });

    await prisma.providerCategory.upsert({
      where: { providerId_categoryId: { providerId: profile.id, categoryId: category.id } },
      update: {},
      create: { providerId: profile.id, categoryId: category.id },
    });

    // Recria os serviços (idempotente)
    await prisma.service.deleteMany({ where: { providerId: profile.id } });
    await prisma.service.createMany({
      data: p.services.map((s) => ({
        providerId: profile.id,
        categoryId: category.id,
        name: s.name,
        priceCents: s.priceCents,
      })),
    });
  }

  return json({ ok: true, categories: CATEGORIES.length, providers: PROVIDERS.length });
}
