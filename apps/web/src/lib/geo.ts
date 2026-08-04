import { env } from "@judeu/env/server";

// Cliente dos serviços de geo (projeto de demonstração): Nominatim público
// (geocoding) e OSRM demo server (rotas). Ambos são serviços públicos
// gratuitos, sujeitos a rate limit e sem SLA — não usar em produção real.
// Só é usado no servidor — nunca expor essas URLs no app.

export type LatLng = { lat: number; lng: number };

function requireUrl(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} não configurada (.env)`);
  return value.replace(/\/$/, "");
}

// ---- Nominatim: endereço -> coordenadas ----
type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export async function geocodeAddress(
  query: string,
): Promise<(LatLng & { displayName: string }) | null> {
  const base = requireUrl(env.NOMINATIM_URL, "NOMINATIM_URL");
  const url = new URL(`${base}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  // Política de uso do Nominatim público exige um User-Agent que identifique
  // a aplicação: https://operations.osmfoundation.org/policies/nominatim/
  const res = await fetch(url, { headers: { "User-Agent": "AjudaMais-Demo/1.0" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as NominatimResult[];
  const first = results[0];
  if (!first) return null;
  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
  };
}

// ---- OSRM: rota entre dois pontos (origem = prestador, destino = casa) ----
type OsrmResponse = {
  routes?: { distance?: number; duration?: number; geometry?: string }[];
};

export type Route = {
  distanceKm: number;
  durationMin: number;
  points: LatLng[] | null; // geometria da rota, já decodificada, p/ desenhar no mapa
};

// Decodifica polyline (algoritmo padrão Google polyline) numa precisão dada.
// Decodificar no servidor evita levar um parser de polyline pro bundle nativo.
function decodePolyline(encoded: string, precision: number): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / precision, lng: lng / precision });
  }

  return points;
}

// Mantido com precisão 1e6 (era o formato do Valhalla).
export function decodePolyline6(encoded: string): LatLng[] {
  return decodePolyline(encoded, 1e6);
}

// OSRM codifica a geometria da rota em polyline de precisão 1e5 por padrão.
export function decodePolyline5(encoded: string): LatLng[] {
  return decodePolyline(encoded, 1e5);
}

export async function routeBetween(from: LatLng, to: LatLng): Promise<Route | null> {
  const base = requireUrl(env.VALHALLA_URL, "VALHALLA_URL");
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = new URL(`${base}/route/v1/driving/${coords}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "polyline");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = (await res.json()) as OsrmResponse;
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    distanceKm: (route.distance ?? 0) / 1000,
    durationMin: Math.round((route.duration ?? 0) / 60),
    points: route.geometry ? decodePolyline5(route.geometry) : null,
  };
}
