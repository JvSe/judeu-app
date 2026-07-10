import { prisma } from "./db";
import { uploadKycDocument } from "./storage";

// ---------------------------------------------------------------------------
// Onboarding profissional do prestador + KYC (RF-B1/B2/B3): cadastro de
// categorias/serviços/raio de atuação e envio do documento de identidade.
// Aprovação (PENDING -> APPROVED/BLOCKED) é manual por ora (sem painel admin,
// RF-H3) — enquanto PENDING, o prestador não aparece no catálogo (listProviders
// já filtra status: "APPROVED").
// ---------------------------------------------------------------------------

export type MyProviderProfileDTO = {
  status: "PENDING" | "APPROVED" | "BLOCKED";
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
  isAvailable: boolean;
  hasDocument: boolean;
  categoryIds: string[];
  services: { id: string; categoryId: string; name: string; priceCents: number }[];
};

export type UpsertProviderProfileInput = {
  headline: string;
  bio?: string;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat?: number;
  baseLng?: number;
  categoryIds: string[];
  services: { name: string; priceCents: number; categoryId: string }[];
};

function toDTO(p: {
  status: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
  isAvailable: boolean;
  documentUrl: string | null;
  categories: { categoryId: string }[];
  services: { id: string; categoryId: string; name: string; priceCents: number }[];
}): MyProviderProfileDTO {
  return {
    status: p.status as MyProviderProfileDTO["status"],
    headline: p.headline,
    bio: p.bio,
    yearsExperience: p.yearsExperience,
    serviceRadiusKm: p.serviceRadiusKm,
    baseLat: p.baseLat,
    baseLng: p.baseLng,
    isAvailable: p.isAvailable,
    hasDocument: !!p.documentUrl,
    categoryIds: p.categories.map((c) => c.categoryId),
    services: p.services,
  };
}

const profileInclude = {
  categories: { select: { categoryId: true } },
  services: { select: { id: true, categoryId: true, name: true, priceCents: true } },
} as const;

export async function getMyProviderProfile(userId: string): Promise<MyProviderProfileDTO | null> {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });
  return profile ? toDTO(profile) : null;
}

// Cria (se ainda não existir) ou atualiza o cadastro profissional do prestador.
// Substitui por completo categorias e serviços a cada chamada (form é a fonte da verdade).
export async function upsertMyProviderProfile(
  userId: string,
  input: UpsertProviderProfileInput,
): Promise<MyProviderProfileDTO> {
  const profile = await prisma.$transaction(async (tx) => {
    const p = await tx.providerProfile.upsert({
      where: { userId },
      update: {
        headline: input.headline,
        bio: input.bio,
        yearsExperience: input.yearsExperience,
        serviceRadiusKm: input.serviceRadiusKm,
        baseLat: input.baseLat,
        baseLng: input.baseLng,
      },
      create: {
        userId,
        headline: input.headline,
        bio: input.bio,
        yearsExperience: input.yearsExperience,
        serviceRadiusKm: input.serviceRadiusKm,
        baseLat: input.baseLat,
        baseLng: input.baseLng,
      },
    });

    await tx.providerCategory.deleteMany({ where: { providerId: p.id } });
    await tx.providerCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({ providerId: p.id, categoryId })),
    });

    await tx.service.deleteMany({ where: { providerId: p.id } });
    await tx.service.createMany({
      data: input.services.map((s) => ({
        providerId: p.id,
        categoryId: s.categoryId,
        name: s.name,
        priceCents: s.priceCents,
      })),
    });

    return tx.providerProfile.findUniqueOrThrow({
      where: { id: p.id },
      include: profileInclude,
    });
  });

  return toDTO(profile);
}

// Envia (ou substitui) o documento de identidade — sobe pro Storage e grava o path.
export async function setProviderDocument(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<MyProviderProfileDTO> {
  const path = await uploadKycDocument(userId, base64, mimeType);

  const profile = await prisma.providerProfile.upsert({
    where: { userId },
    update: { documentUrl: path },
    create: { userId, documentUrl: path },
    include: profileInclude,
  });

  return toDTO(profile);
}

// Liga/desliga a disponibilidade do prestador para receber pedidos (RF-B4).
// Não exige status APPROVED — o prestador pode preparar isso antes da aprovação,
// só não aparece no catálogo (listProviders) enquanto não for APPROVED.
export async function setProviderAvailability(
  userId: string,
  isAvailable: boolean,
): Promise<MyProviderProfileDTO> {
  const profile = await prisma.providerProfile.upsert({
    where: { userId },
    update: { isAvailable },
    create: { userId, isAvailable },
    include: profileInclude,
  });
  return toDTO(profile);
}

// ---------------------------------------------------------------------------
// Moderação (RF-H3, painel admin): fila de aprovação de KYC.
// ---------------------------------------------------------------------------

export type AdminProviderDTO = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "APPROVED" | "BLOCKED";
  headline: string | null;
  yearsExperience: number;
  hasDocument: boolean;
  categoryNames: string[];
  serviceCount: number;
  createdAt: string;
};

export async function listAllProviderProfiles(): Promise<AdminProviderDTO[]> {
  const rows = await prisma.providerProfile.findMany({
    include: {
      user: { select: { fullName: true, email: true } },
      categories: { include: { category: { select: { name: true } } } },
      _count: { select: { services: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((p) => ({
    id: p.id,
    fullName: p.user.fullName,
    email: p.user.email,
    status: p.status,
    headline: p.headline,
    yearsExperience: p.yearsExperience,
    hasDocument: !!p.documentUrl,
    categoryNames: p.categories.map((c) => c.category.name),
    serviceCount: p._count.services,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function setProviderProfileStatus(
  providerId: string,
  status: "PENDING" | "APPROVED" | "BLOCKED",
): Promise<void> {
  await prisma.providerProfile.update({ where: { id: providerId }, data: { status } });
}
