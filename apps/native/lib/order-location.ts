import * as Location from "expo-location";

import { distanceKm } from "@/lib/nearby";

/** Acima desta distância do endereço padrão, o pedido pergunta qual local usar. */
export const FAR_FROM_DEFAULT_METERS = 300;

type Coords = { lat: number; lng: number };

export function isFarFromAddress(position: Coords, address: Coords): boolean {
  return distanceKm(position, address) * 1000 > FAR_FROM_DEFAULT_METERS;
}

/** O Android costuma devolver o nome do estado por extenso; o formulário exige a UF. */
const UF_BY_STATE: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function toUf(region: string | null | undefined): string | undefined {
  const value = region?.trim();
  if (!value) return undefined;
  if (value.length === 2) return value.toUpperCase();
  const key = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return UF_BY_STATE[key];
}

/** Params de rota do formulário de endereço (todos texto; os vazios ficam de fora). */
export type AddressFormPrefill = {
  lat: string;
  lng: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  cep?: string;
};

/** Converte a posição em campos do formulário. Se falhar, devolve só as coordenadas. */
export async function reverseGeocodeForAddressForm(position: Coords): Promise<AddressFormPrefill> {
  const prefill: AddressFormPrefill = { lat: String(position.lat), lng: String(position.lng) };
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.lat,
      longitude: position.lng,
    });
    if (!place) return prefill;
    const fields = {
      street: place.street ?? undefined,
      number: place.streetNumber ?? undefined,
      neighborhood: place.district ?? undefined,
      city: place.city ?? place.subregion ?? undefined,
      uf: toUf(place.region),
      cep: place.postalCode?.replace(/\D/g, "").slice(0, 8) || undefined,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value) prefill[key as keyof typeof fields] = value;
    }
  } catch (err) {
    console.warn("[order-location] reverse geocode falhou:", err);
  }
  return prefill;
}
