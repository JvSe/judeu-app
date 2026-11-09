// Dados reais dos dois usuários do Modo Apresentação, embarcados no app.
// Gerado por `node scripts/demo-snapshot.mjs` (somente leitura no banco).
import type { AppUser, Category, MyProviderProfile, OrderAddress, SavedAddress } from "@/lib/api";

import raw from "./fixtures.json";

type FixtureUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  gender: string | null;
  createdAt: string;
};

type FixtureAddress = Omit<SavedAddress, "isDefault"> & { userId: string; isDefault: boolean };

type FixtureProfile = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  ratingAvg: number;
  ratingCount: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
};

type FixtureCategory = { id: string; slug: string; name: string; icon: string | null };

type Fixtures = {
  clientId: string;
  helperId: string;
  users: FixtureUser[];
  addresses: FixtureAddress[];
  profiles: FixtureProfile[];
  categories: FixtureCategory[];
};

const data = raw as unknown as Fixtures;

export const DEMO_CLIENT_ID = data.clientId;
export const DEMO_HELPER_ID = data.helperId;

// Centro de Palmas/TO — usado só se o cliente não tiver endereço no snapshot.
const PALMAS = { lat: -10.1841, lng: -48.3336 };

export function isDemoUserId(id: string | null | undefined): boolean {
  return id === DEMO_CLIENT_ID || id === DEMO_HELPER_ID;
}

export function demoUserByEmail(email: string): FixtureUser | null {
  const wanted = email.trim().toLowerCase();
  return data.users.find((u) => u.email.trim().toLowerCase() === wanted) ?? null;
}

function rawUser(id: string): FixtureUser {
  const user = data.users.find((u) => u.id === id);
  if (!user) throw new Error(`Usuário demo ausente no fixture: ${id}`);
  return user;
}

/** AppUser como o app espera. Na demo o cliente só pede e o ajudante também atende. */
export function demoAppUser(id: string): AppUser {
  const u = rawUser(id);
  const gender = u.gender === "F" || u.gender === "M" || u.gender === "OTHER" ? u.gender : null;
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: id === DEMO_HELPER_ID ? "BOTH" : "CLIENT",
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    gender,
    createdAt: u.createdAt,
  };
}

export function firstName(id: string): string {
  return rawUser(id).fullName.trim().split(/\s+/)[0] ?? "";
}

export function demoAddresses(userId: string): SavedAddress[] {
  const list = data.addresses
    .filter((a) => a.userId === userId)
    .map(({ userId: _owner, ...rest }) => rest);
  if (list.length > 0 && !list.some((a) => a.isDefault)) list[0] = { ...list[0], isDefault: true };
  return list;
}

/** Endereço padrão do cliente — onde a ajuda acontece. */
export function clientHomeAddress(): OrderAddress {
  const a = demoAddresses(DEMO_CLIENT_ID).find((x) => x.isDefault);
  if (!a) {
    return {
      label: "Casa",
      street: "Quadra 104 Norte",
      number: null,
      neighborhood: "Plano Diretor Norte",
      city: "Palmas",
      state: "TO",
      ...PALMAS,
    };
  }
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

/** Ponto de partida de quem atende: ~1 km do cliente (sempre dentro do raio). */
export function helperStartPoint(): { lat: number; lng: number } {
  const home = clientHomeAddress();
  return { lat: home.lat + 0.0062, lng: home.lng - 0.0049 };
}

export function demoCategories(): Category[] {
  return data.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: 0,
    featured: false,
  }));
}

export function categoryName(id: string | null | undefined): string | null {
  if (!id) return null;
  return data.categories.find((c) => c.id === id)?.name ?? null;
}

function helperFixtureProfile(): FixtureProfile | null {
  return data.profiles.find((p) => p.userId === DEMO_HELPER_ID) ?? null;
}

export function helperProviderId(): string {
  return helperFixtureProfile()?.id ?? `demo-provider-${DEMO_HELPER_ID}`;
}

export function helperRating(): { avg: number; count: number } {
  const p = helperFixtureProfile();
  return { avg: p?.ratingAvg ?? 0, count: p?.ratingCount ?? 0 };
}

/** Perfil de quem atende — sempre aprovado e verificado na demo. */
export function helperProfile(isAvailable: boolean): MyProviderProfile {
  const p = helperFixtureProfile();
  const start = helperStartPoint();
  return {
    status: "APPROVED",
    headline: p?.headline ?? null,
    bio: p?.bio ?? null,
    yearsExperience: p?.yearsExperience ?? 0,
    serviceRadiusKm: Math.max(p?.serviceRadiusKm ?? 15, 15),
    baseLat: start.lat,
    baseLng: start.lng,
    isAvailable,
    isHelper: true,
    allowsNegotiation: true,
    isCompany: false,
    companyName: null,
    responsibleName: null,
    hasDocument: true,
    hasSelfie: true,
    hasBackgroundCheck: true,
    reverifyRequired: false,
    categoryIds: [],
    services: [],
  };
}
