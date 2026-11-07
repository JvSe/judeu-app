import { env } from "@judeu/env/server";

import {
  GOOGLE_ROUTES_FIELD_MASK,
  GOOGLE_ROUTES_URL,
  type Geocoded,
  type LatLng,
  type Route,
  googleGeocodeUrl,
  googleRouteBody,
  nominatimSearchUrl,
  osrmRouteUrl,
  parseGoogleGeocode,
  parseGoogleRoute,
  parseNominatim,
  parseOsrmRoute,
  parseValhallaRoute,
  valhallaRouteBody,
} from "./geo-providers";

// Cliente dos serviços de geo, só no servidor (nunca expor URLs/chaves no app).
// Provedor escolhido por env — o padrão é o comportamento de sempre:
//   ROUTING_PROVIDER=osrm (OSRM_URL → VALHALLA_URL legado → OSRM público)
//   GEOCODING_PROVIDER=nominatim (NOMINATIM_URL)
// Trocar para o Valhalla próprio (apps/geo) ou para o Google é só mudar a env,
// quando os gatilhos de /admin/metrics indicarem (ETA erra > 20%, endereço > 3%).

export type { LatLng, Route } from "./geo-providers";
export { decodePolyline5, decodePolyline6 } from "./geo-providers";

const DEFAULT_OSRM_BASE = "https://router.project-osrm.org";
const TIMEOUT_MS = 12_000;

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} não configurada (.env)`);
  return value;
}

// ---- Endereço → coordenadas ----
export async function geocodeAddress(query: string): Promise<Geocoded | null> {
  if (env.GEOCODING_PROVIDER === "google") {
    const key = requireValue(env.GOOGLE_MAPS_API_KEY, "GOOGLE_MAPS_API_KEY");
    const res = await fetch(googleGeocodeUrl(query, key), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Google Geocoding ${res.status}`);
    return parseGoogleGeocode(await res.json());
  }

  const base = trimSlash(requireValue(env.NOMINATIM_URL, "NOMINATIM_URL"));
  // Política de uso do Nominatim público exige um User-Agent que identifique
  // a aplicação: https://operations.osmfoundation.org/policies/nominatim/
  const res = await fetch(nominatimSearchUrl(base, query), {
    headers: { "User-Agent": "AjudaMais/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return parseNominatim(await res.json());
}

// Distância em linha reta (haversine), em km — usado para detectar chegada do
// prestador sem depender do roteamento, que roda best-effort (RF-E3).
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Fallback quando o roteamento está indisponível — linha reta + ETA aproximado (~30 km/h urbano).
export function straightLineRoute(from: LatLng, to: LatLng): Route {
  const distanceKm = haversineKm(from, to);
  const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));
  return { distanceKm, durationMin, points: [from, to] };
}

/** Base do OSRM: OSRM_URL; senão o VALHALLA_URL legado (que sempre apontou para um OSRM); senão o público. */
export function osrmBaseUrl(e: { OSRM_URL?: string; VALHALLA_URL?: string } = env): string {
  return trimSlash(e.OSRM_URL || e.VALHALLA_URL || DEFAULT_OSRM_BASE);
}

async function fetchRoute(from: LatLng, to: LatLng): Promise<Route> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  switch (env.ROUTING_PROVIDER) {
    case "valhalla": {
      const base = trimSlash(requireValue(env.VALHALLA_URL, "VALHALLA_URL"));
      const res = await fetch(`${base}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valhallaRouteBody(from, to)),
        signal,
      });
      if (!res.ok) throw new Error(`Valhalla ${res.status}`);
      return parseValhallaRoute(await res.json());
    }
    case "google": {
      const res = await fetch(GOOGLE_ROUTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": requireValue(env.GOOGLE_MAPS_API_KEY, "GOOGLE_MAPS_API_KEY"),
          "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(googleRouteBody(from, to)),
        signal,
      });
      if (!res.ok) throw new Error(`Google Routes ${res.status}`);
      return parseGoogleRoute(await res.json());
    }
    default: {
      const res = await fetch(osrmRouteUrl(osrmBaseUrl(), from, to), { signal });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      return parseOsrmRoute(await res.json());
    }
  }
}

export async function routeBetween(from: LatLng, to: LatLng): Promise<Route> {
  try {
    return await fetchRoute(from, to);
  } catch (err) {
    console.warn(`[geo] roteamento (${env.ROUTING_PROVIDER}) falhou, usando linha reta:`, err);
    return straightLineRoute(from, to);
  }
}
