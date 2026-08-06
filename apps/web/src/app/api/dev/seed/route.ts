import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { LatLng } from "@/lib/geo";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

// Seed de desenvolvimento: popula categorias + prestadores de exemplo, todos
// posicionados perto de SEED_CENTER. Idempotente. Bloqueado em produção.

const SEED_CENTER: LatLng = { lat: -10.23172, lng: -48.324216 };

const EARTH_RADIUS_KM = 6371;
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
// Nunca posiciona um prestador em cima do centro.
const MIN_DISTANCE_KM = 0.3;
const SPREAD_RADIUS_KM = 1;

function destinationPoint(origin: LatLng, distanceKm: number, bearingRad: number): LatLng {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

// Distribui `count` pontos ao redor de `center` num raio de SPREAD_RADIUS_KM,
// nunca mais perto que MIN_DISTANCE_KM. Layout em espiral áurea (sunflower):
// densidade uniforme do mínimo até a borda, sem dois pontos se sobrepondo.
function distributeAround(center: LatLng, count: number): LatLng[] {
  return Array.from({ length: count }, (_, index) => {
    const spreadFraction = count > 1 ? Math.sqrt(index / (count - 1)) : 1;
    const distance = MIN_DISTANCE_KM + spreadFraction * (SPREAD_RADIUS_KM - MIN_DISTANCE_KM);
    const bearingRad = index * GOLDEN_ANGLE_RAD;
    return destinationPoint(center, distance, bearingRad);
  });
}

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
  const positions = distributeAround(SEED_CENTER, PROVIDERS.length);

  for (const [index, p] of PROVIDERS.entries()) {
    const { lat, lng } = positions[index];
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
        baseLat: lat,
        baseLng: lng,
      },
      create: {
        userId: user.id,
        headline: p.role,
        yearsExperience: p.years,
        status: "APPROVED",
        isAvailable: true,
        ratingAvg: p.rating,
        ratingCount: p.reviews,
        baseLat: lat,
        baseLng: lng,
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
