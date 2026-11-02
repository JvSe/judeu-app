import { randomUUID } from "node:crypto";

import { supabase } from "./db";
import { geocodeAddress } from "./geo";
import { FALLBACK_LAT, FALLBACK_LNG } from "./orders";

export type AddressDTO = {
  id: string;
  label: string | null;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isDefault: boolean;
};

export type AddressInput = {
  label?: string;
  cep?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};

function toDTO(a: {
  id: string;
  label: string | null;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}): AddressDTO {
  return {
    id: a.id,
    label: a.label,
    cep: a.cep,
    street: a.street,
    number: a.number,
    complement: a.complement,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    lat: a.lat,
    lng: a.lng,
    isDefault: a.isDefault,
  };
}

export async function listAddresses(userId: string): Promise<AddressDTO[]> {
  const { data: rows, error } = await supabase
    .from("address")
    .select("*")
    .eq("userId", userId)
    .order("isDefault", { ascending: false })
    .order("createdAt", { ascending: false });
  if (error) throw new Error(error.message);
  return (rows ?? []).map(toDTO);
}

async function resolveLatLng(input: AddressInput): Promise<{ lat: number; lng: number }> {
  const query = [
    `${input.street}${input.number ? `, ${input.number}` : ""}`,
    input.neighborhood,
    input.city,
    input.state,
  ]
    .filter(Boolean)
    .join(", ");
  try {
    const geocoded = await geocodeAddress(query);
    if (geocoded) return { lat: geocoded.lat, lng: geocoded.lng };
    console.warn(`[addresses] Nominatim não encontrou resultado para "${query}"`);
  } catch (err) {
    console.warn(`[addresses] geocodeAddress falhou para "${query}":`, err);
  }
  if (input.lat != null && input.lng != null) {
    return { lat: input.lat, lng: input.lng };
  }
  return { lat: FALLBACK_LAT, lng: FALLBACK_LNG };
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressDTO> {
  const { lat, lng } = await resolveLatLng(input);
  const { count } = await supabase
    .from("address")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId);
  const makeDefault = input.isDefault === true || (count ?? 0) === 0;

  if (makeDefault) {
    await supabase.from("address").update({ isDefault: false }).eq("userId", userId).eq("isDefault", true);
  }

  const { data: address, error } = await supabase
    .from("address")
    .insert({
      id: randomUUID(),
      userId,
      label: input.label ?? null,
      cep: input.cep ?? null,
      street: input.street,
      number: input.number ?? null,
      complement: input.complement ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city,
      state: input.state,
      lat,
      lng,
      isDefault: makeDefault,
    })
    .select("*")
    .single();
  if (error || !address) throw new Error(error?.message ?? "Falha ao criar endereço");
  return toDTO(address);
}

export async function updateAddress(
  userId: string,
  id: string,
  input: Partial<AddressInput>,
): Promise<AddressDTO | { error: string; status: number }> {
  const { data: existing } = await supabase.from("address").select("*").eq("id", id).maybeSingle();
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado", status: 404 };
  }

  let lat = existing.lat;
  let lng = existing.lng;
  if (input.lat != null && input.lng != null) {
    lat = input.lat;
    lng = input.lng;
  } else if (input.street || input.number || input.neighborhood || input.city || input.state) {
    const resolved = await resolveLatLng({
      street: input.street ?? existing.street,
      number: input.number ?? existing.number ?? undefined,
      neighborhood: input.neighborhood ?? existing.neighborhood ?? undefined,
      city: input.city ?? existing.city,
      state: input.state ?? existing.state,
    });
    lat = resolved.lat;
    lng = resolved.lng;
  }

  const { data: address, error } = await supabase
    .from("address")
    .update({
      label: input.label ?? existing.label,
      cep: input.cep ?? existing.cep,
      street: input.street ?? existing.street,
      number: input.number ?? existing.number,
      complement: input.complement ?? existing.complement,
      neighborhood: input.neighborhood ?? existing.neighborhood,
      city: input.city ?? existing.city,
      state: input.state ?? existing.state,
      lat,
      lng,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !address) throw new Error(error?.message ?? "Falha ao atualizar");
  return toDTO(address);
}

export async function deleteAddress(
  userId: string,
  id: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const { data: existing } = await supabase.from("address").select("*").eq("id", id).maybeSingle();
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado", status: 404 };
  }

  const { error } = await supabase.from("address").delete().eq("id", id);
  if (error) {
    if (/foreign key|violates foreign/i.test(error.message)) {
      return { error: "Não é possível excluir: endereço vinculado a um pedido", status: 409 };
    }
    throw new Error(error.message);
  }

  if (existing.isDefault) {
    const { data: next } = await supabase
      .from("address")
      .select("id")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("address").update({ isDefault: true }).eq("id", next.id);
  }

  return { ok: true };
}

export async function setDefaultAddress(
  userId: string,
  id: string,
): Promise<AddressDTO | { error: string; status: number }> {
  const { data: existing } = await supabase.from("address").select("*").eq("id", id).maybeSingle();
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado", status: 404 };
  }

  const { data: address, error } = await supabase.rpc("set_default_address", {
    p_user_id: userId,
    p_address_id: id,
  });
  if (error || !address) throw new Error(error?.message ?? "Falha ao definir padrão");
  return toDTO(address);
}
