import { randomUUID } from "node:crypto";

import { supabase } from "./db";
import { notifyUser } from "./notifications";
import { uploadKycDocument } from "./storage";
import { publicUser, type PublicUser } from "./user";

export type MyProviderProfileDTO = {
  status: "PENDING" | "APPROVED" | "BLOCKED";
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
  isAvailable: boolean;
  isHelper: boolean;
  allowsNegotiation: boolean;
  isCompany: boolean;
  companyName: string | null;
  responsibleName: string | null;
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
  allowsNegotiation?: boolean;
  isCompany?: boolean;
  companyName?: string;
  responsibleName?: string;
  categoryIds: string[];
  services: { name: string; priceCents: number; categoryId: string }[];
};

const PROFILE_SELECT = `
  *,
  categories:providercategory(categoryId),
  services:service(id, categoryId, name, priceCents)
`;

function toDTO(p: {
  status: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  serviceRadiusKm: number;
  baseLat: number | null;
  baseLng: number | null;
  isAvailable: boolean;
  isHelper: boolean;
  allowsNegotiation: boolean;
  isCompany: boolean;
  companyName: string | null;
  responsibleName: string | null;
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
    isHelper: p.isHelper,
    allowsNegotiation: p.allowsNegotiation,
    isCompany: p.isCompany,
    companyName: p.companyName,
    responsibleName: p.responsibleName,
    hasDocument: !!p.documentUrl,
    categoryIds: p.categories.map((c) => c.categoryId),
    services: p.services,
  };
}

async function loadProfile(userId: string) {
  const { data } = await supabase
    .from("providerprofile")
    .select(PROFILE_SELECT)
    .eq("userId", userId)
    .maybeSingle();
  return data as unknown as Parameters<typeof toDTO>[0] | null;
}

export async function getMyProviderProfile(userId: string): Promise<MyProviderProfileDTO | null> {
  const profile = await loadProfile(userId);
  return profile ? toDTO(profile) : null;
}

type ExistingProfileForUpsert = {
  isHelper: boolean;
  status: MyProviderProfileDTO["status"];
  baseLat: number | null;
  baseLng: number | null;
};

/**
 * Campos que o upsert profissional grava além dos dados do formulário.
 * - Helper que vira profissional volta para PENDING: o helper não passou por
 *   KYC e não pode herdar o APPROVED (QA H-01). BLOCKED continua BLOCKED.
 * - Profissional que só edita o cadastro mantém o status (sem nova análise).
 * - Base (baseLat/baseLng) só muda quando o app envia; senão preserva (QA P-14).
 */
export function professionalUpsertOverrides(
  existing: ExistingProfileForUpsert | null,
  input: Pick<UpsertProviderProfileInput, "baseLat" | "baseLng">,
): { status?: "PENDING"; baseLat: number | null; baseLng: number | null } {
  const hasBase = input.baseLat != null && input.baseLng != null;
  const base = hasBase
    ? { baseLat: input.baseLat!, baseLng: input.baseLng! }
    : { baseLat: existing?.baseLat ?? null, baseLng: existing?.baseLng ?? null };
  if (existing?.isHelper && existing.status !== "BLOCKED") {
    return { status: "PENDING", ...base };
  }
  return base;
}

export async function upsertMyProviderProfile(
  userId: string,
  input: UpsertProviderProfileInput,
): Promise<MyProviderProfileDTO> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("providerprofile")
    .select("id, isHelper, status, baseLat, baseLng")
    .eq("userId", userId)
    .maybeSingle();

  const payload = {
    headline: input.headline,
    bio: input.bio ?? null,
    yearsExperience: input.yearsExperience,
    serviceRadiusKm: input.serviceRadiusKm,
    allowsNegotiation: input.allowsNegotiation ?? false,
    isHelper: false,
    isCompany: input.isCompany ?? false,
    companyName: input.isCompany ? (input.companyName ?? null) : null,
    responsibleName: input.isCompany ? (input.responsibleName ?? null) : null,
    updatedAt: now,
    ...professionalUpsertOverrides(existing, input),
  };

  let providerId: string;
  if (existing) {
    const { error } = await supabase.from("providerprofile").update(payload).eq("userId", userId);
    if (error) throw new Error(error.message);
    providerId = existing.id;
  } else {
    providerId = randomUUID();
    const { error } = await supabase.from("providerprofile").insert({
      id: providerId,
      userId,
      ...payload,
      createdAt: now,
    });
    if (error) throw new Error(error.message);
  }

  const { error: rpcError } = await supabase.rpc("replace_provider_categories_services", {
    p_provider_id: providerId,
    p_category_ids: input.categoryIds,
    p_services: input.services,
  });
  if (rpcError) throw new Error(rpcError.message);

  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Perfil não encontrado após upsert");
  return toDTO(profile);
}

export async function setProviderDocument(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<MyProviderProfileDTO> {
  const path = await uploadKycDocument(userId, base64, mimeType);
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("providerprofile")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("providerprofile")
      .update({ documentUrl: path, updatedAt: now })
      .eq("userId", userId);
  } else {
    await supabase.from("providerprofile").insert({
      id: randomUUID(),
      userId,
      documentUrl: path,
      createdAt: now,
      updatedAt: now,
    });
  }

  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Perfil não encontrado");
  return toDTO(profile);
}

export async function setProviderAvailability(
  userId: string,
  isAvailable: boolean,
): Promise<MyProviderProfileDTO | { error: string; status: number }> {
  const existing = await loadProfile(userId);
  if (!existing) {
    return {
      error: "Complete o cadastro antes de ficar disponível.",
      status: 404,
    };
  }
  if (isAvailable && existing.status === "BLOCKED") {
    return { error: "Cadastro bloqueado. Fale com o suporte.", status: 403 };
  }
  // Helper e profissional só ficam disponíveis depois de aprovados. Antes, o
  // helper nascia APPROVED e passava direto (pitch × app, item "cadastro verificado").
  if (isAvailable && existing.status !== "APPROVED") {
    return {
      error: "Seu cadastro ainda não foi aprovado.",
      status: 403,
    };
  }
  const now = new Date().toISOString();
  await supabase
    .from("providerprofile")
    .update({ isAvailable, updatedAt: now })
    .eq("userId", userId);
  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Perfil não encontrado");
  return toDTO(profile);
}

export type RegisterHelperInput = {
  fullName: string;
  phone: string;
  bio?: string;
  lat?: number;
  lng?: number;
};

export async function registerHelper(
  userId: string,
  input: RegisterHelperInput,
): Promise<{ user: PublicUser; profile: MyProviderProfileDTO } | { error: string; status: number }> {
  const { data: user } = await supabase.from("user").select("*").eq("id", userId).maybeSingle();
  if (!user || user.deletedAt) return { error: "Conta não encontrada", status: 404 };
  if (user.role === "PROVIDER") {
    return { error: "Você já atende como prestador. Use a área de quem trabalha.", status: 409 };
  }

  const existing = await loadProfile(userId);
  if (existing && !existing.isHelper) {
    return { error: "Você já tem cadastro de prestador. Use a área de quem trabalha.", status: 409 };
  }
  if (existing?.status === "BLOCKED") {
    return { error: "Cadastro bloqueado. Fale com o suporte.", status: 403 };
  }

  const now = new Date().toISOString();
  const hasCoords = input.lat != null && input.lng != null;
  const coords = hasCoords
    ? {
        baseLat: input.lat!,
        baseLng: input.lng!,
        lastLat: input.lat!,
        lastLng: input.lng!,
        lastLocationAt: now,
      }
    : {};

  await supabase
    .from("user")
    .update({
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      role: "BOTH",
      updatedAt: now,
    })
    .eq("id", userId);

  // Cadastro novo de helper nasce PENDING e espera aprovação no painel admin.
  // Helper que já existe mantém o status (quem já estava aprovado continua).
  const profilePayload = {
    isHelper: true,
    ...(existing ? {} : { status: "PENDING" as const }),
    isAvailable: false,
    headline: "Ajuda perto de você",
    bio: input.bio?.trim() || null,
    updatedAt: now,
    ...coords,
  };

  if (existing) {
    await supabase.from("providerprofile").update(profilePayload).eq("userId", userId);
  } else {
    await supabase.from("providerprofile").insert({
      id: randomUUID(),
      userId,
      ...profilePayload,
      createdAt: now,
    });
  }

  const { data: updated } = await supabase.from("user").select("*").eq("id", userId).single();
  const profile = await loadProfile(userId);
  if (!updated || !profile) throw new Error("Falha ao registrar helper");
  return { user: publicUser(updated), profile: toDTO(profile) };
}

export type UpdateHelperProfileInput = {
  bio?: string;
  serviceRadiusKm?: number;
};

// Edição do cadastro de quem atende ajudas (helper). Diferente do upsert
// profissional, preserva isHelper/status — o helper não passa por KYC e o
// upsert o rebaixaria a profissional PENDING.
export async function updateHelperProfile(
  userId: string,
  input: UpdateHelperProfileInput,
): Promise<MyProviderProfileDTO | { error: string; status: number }> {
  const existing = await loadProfile(userId);
  if (!existing) return { error: "Cadastro de quem atende não encontrado", status: 404 };
  if (!existing.isHelper) {
    return { error: "Edite seu cadastro profissional pela tela de cadastro", status: 409 };
  }

  const payload: { updatedAt: string; bio?: string | null; serviceRadiusKm?: number } = {
    updatedAt: new Date().toISOString(),
  };
  if (input.bio !== undefined) payload.bio = input.bio.trim() || null;
  if (input.serviceRadiusKm !== undefined) payload.serviceRadiusKm = input.serviceRadiusKm;

  const { error } = await supabase.from("providerprofile").update(payload).eq("userId", userId);
  if (error) throw new Error(error.message);

  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Falha ao atualizar cadastro de quem atende");
  return toDTO(profile);
}

export async function updateProviderLocation(
  userId: string,
  lat: number,
  lng: number,
): Promise<MyProviderProfileDTO | { error: string; status: number }> {
  const existing = await loadProfile(userId);
  if (!existing) return { error: "Cadastro profissional não encontrado", status: 404 };
  await supabase
    .from("providerprofile")
    .update({
      lastLat: lat,
      lastLng: lng,
      lastLocationAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("userId", userId);
  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Perfil não encontrado");
  return toDTO(profile);
}

export type AdminProviderDTO = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "APPROVED" | "BLOCKED";
  headline: string | null;
  yearsExperience: number;
  isCompany: boolean;
  isHelper: boolean;
  companyName: string | null;
  responsibleName: string | null;
  hasDocument: boolean;
  categoryNames: string[];
  serviceCount: number;
  createdAt: string;
};

export async function listAllProviderProfiles(): Promise<AdminProviderDTO[]> {
  const { data: rows, error } = await supabase
    .from("providerprofile")
    .select(
      `
      *,
      user:user!inner(fullName, email),
      categories:providercategory(category:category(name)),
      services:service(id)
    `,
    )
    .order("status")
    .order("createdAt", { ascending: false });
  if (error) throw new Error(error.message);

  return (rows ?? []).map((p) => {
    const row = p as unknown as {
      id: string;
      status: AdminProviderDTO["status"];
      headline: string | null;
      yearsExperience: number;
      isCompany: boolean;
      isHelper: boolean;
      companyName: string | null;
      responsibleName: string | null;
      documentUrl: string | null;
      createdAt: string;
      user: { fullName: string; email: string };
      categories: { category: { name: string } }[];
      services: { id: string }[];
    };
    return {
      id: row.id,
      fullName: row.user.fullName,
      email: row.user.email,
      status: row.status,
      headline: row.headline,
      yearsExperience: row.yearsExperience,
      isCompany: row.isCompany,
      isHelper: row.isHelper,
      companyName: row.companyName,
      responsibleName: row.responsibleName,
      hasDocument: !!row.documentUrl,
      categoryNames: row.categories.map((c) => c.category.name),
      serviceCount: row.services.length,
      createdAt: row.createdAt,
    };
  });
}

export async function setProviderProfileStatus(
  providerId: string,
  status: "PENDING" | "APPROVED" | "BLOCKED",
): Promise<void> {
  const { data: before } = await supabase
    .from("providerprofile")
    .select("userId, status")
    .eq("id", providerId)
    .maybeSingle();
  const { error } = await supabase
    .from("providerprofile")
    .update({
      status,
      // Bloqueado sai do ar na hora.
      ...(status === "BLOCKED" ? { isAvailable: false } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", providerId);
  if (error) throw new Error(error.message);

  // Avisa quem atende (QA P-05): antes ninguém sabia que tinha sido aprovado.
  if (before && before.status !== status && status !== "PENDING") {
    void notifyUser(before.userId, "SUPPORT", {
      title: status === "APPROVED" ? "Cadastro aprovado" : "Cadastro bloqueado",
      body:
        status === "APPROVED"
          ? "Você já pode ligar o modo atendimento e receber pedidos perto de você."
          : "Seu cadastro para atender foi bloqueado. Fale com o suporte para entender o motivo.",
      data: { type: "provider_status", status },
    });
  }
}
