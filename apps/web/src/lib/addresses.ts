import { prisma } from "./db";
import { geocodeAddress } from "./geo";
import { FALLBACK_LAT, FALLBACK_LNG } from "./orders";

// ---------------------------------------------------------------------------
// Endereços salvos do cliente (RF-A6) — livro de endereços reutilizável, além
// do endereço avulso que já podia ser digitado direto no pedido (RF-C6).
// ---------------------------------------------------------------------------

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
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

// Geocodifica igual ao cadastro de pedido (best-effort via Nominatim, fallback
// pro centro de Palmas sem NOMINATIM_URL configurada — RF-C6).
async function resolveLatLng(input: AddressInput): Promise<{ lat: number; lng: number }> {
  if (input.lat != null && input.lng != null) return { lat: input.lat, lng: input.lng };
  try {
    const query = [
      `${input.street}${input.number ? `, ${input.number}` : ""}`,
      input.neighborhood,
      input.city,
      input.state,
    ]
      .filter(Boolean)
      .join(", ");
    const geocoded = await geocodeAddress(query);
    if (geocoded) return { lat: geocoded.lat, lng: geocoded.lng };
  } catch {
    // Nominatim indisponível/não configurada — segue com o fallback abaixo.
  }
  return { lat: FALLBACK_LAT, lng: FALLBACK_LNG };
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressDTO> {
  const { lat, lng } = await resolveLatLng(input);
  const existingCount = await prisma.address.count({ where: { userId } });
  const makeDefault = input.isDefault === true || existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        user: { connect: { id: userId } },
        label: input.label,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        lat,
        lng,
        isDefault: makeDefault,
      },
    });
  });

  return toDTO(address);
}

export async function updateAddress(
  userId: string,
  id: string,
  input: Partial<AddressInput>,
): Promise<AddressDTO | { error: string; status: number }> {
  const existing = await prisma.address.findUnique({ where: { id } });
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

  const address = await prisma.address.update({
    where: { id },
    data: {
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
    },
  });
  return toDTO(address);
}

export async function deleteAddress(
  userId: string,
  id: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado", status: 404 };
  }

  await prisma.address.delete({ where: { id } });

  // Se apagou o endereço padrão e ainda sobrou algum, promove o mais recente.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return { ok: true };
}

export async function setDefaultAddress(
  userId: string,
  id: string,
): Promise<AddressDTO | { error: string; status: number }> {
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado", status: 404 };
  }

  const [, address] = await prisma.$transaction([
    prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return toDTO(address);
}
