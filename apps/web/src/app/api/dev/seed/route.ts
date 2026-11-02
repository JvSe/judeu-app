import { randomUUID } from "node:crypto";

import { hashPassword } from "@/lib/auth";
import { supabase } from "@/lib/db";
import type { LatLng } from "@/lib/geo";
import { error, handleOptions, json } from "@/lib/http";

export const runtime = "nodejs";

const SEED_CENTER: LatLng = { lat: -10.23172, lng: -48.324216 };

const EARTH_RADIUS_KM = 6371;
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
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

  const now = new Date().toISOString();
  for (const c of CATEGORIES) {
    const { data: existing } = await supabase
      .from("category")
      .select("id")
      .eq("slug", c.slug)
      .maybeSingle();
    if (existing) {
      await supabase.from("category").update({ name: c.name, icon: c.icon }).eq("id", existing.id);
    } else {
      await supabase.from("category").insert({
        id: randomUUID(),
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        createdAt: now,
      });
    }
  }

  const passwordHash = await hashPassword("provider-demo-1234");
  const positions = distributeAround(SEED_CENTER, PROVIDERS.length);

  for (const [index, p] of PROVIDERS.entries()) {
    const { lat, lng } = positions[index];
    const { data: category } = await supabase
      .from("category")
      .select("id")
      .eq("slug", p.category)
      .maybeSingle();
    if (!category) continue;

    const { data: existingUser } = await supabase
      .from("user")
      .select("id")
      .eq("email", p.email)
      .maybeSingle();

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await supabase
        .from("user")
        .update({ fullName: p.name, role: "PROVIDER", updatedAt: now })
        .eq("id", userId);
    } else {
      userId = randomUUID();
      await supabase.from("user").insert({
        id: userId,
        email: p.email,
        fullName: p.name,
        role: "PROVIDER",
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    const { data: existingProfile } = await supabase
      .from("providerprofile")
      .select("id")
      .eq("userId", userId)
      .maybeSingle();

    const profilePayload = {
      headline: p.role,
      yearsExperience: p.years,
      status: "APPROVED" as const,
      isAvailable: true,
      ratingAvg: p.rating,
      ratingCount: p.reviews,
      baseLat: lat,
      baseLng: lng,
      updatedAt: now,
    };

    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile.id;
      await supabase.from("providerprofile").update(profilePayload).eq("id", profileId);
    } else {
      profileId = randomUUID();
      await supabase.from("providerprofile").insert({
        id: profileId,
        userId,
        ...profilePayload,
        createdAt: now,
      });
    }

    await supabase.from("providercategory").upsert(
      { providerId: profileId, categoryId: category.id },
      { onConflict: "providerId,categoryId" },
    );

    await supabase.from("service").delete().eq("providerId", profileId);
    await supabase.from("service").insert(
      p.services.map((s) => ({
        id: randomUUID(),
        providerId: profileId,
        categoryId: category.id,
        name: s.name,
        priceCents: s.priceCents,
        createdAt: now,
      })),
    );
  }

  return json({ ok: true, categories: CATEGORIES.length, providers: PROVIDERS.length });
}
