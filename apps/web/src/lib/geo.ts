import { env } from "@judeu/env/server";

// Cliente dos serviços de geo self-hosted (Railway): Nominatim (geocoding) e
// Valhalla (rotas). Só é usado no servidor — nunca expor essas URLs no app.

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

  const res = await fetch(url, { headers: { "User-Agent": "AjudaMais/1.0" } });
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

// ---- Valhalla: rota entre dois pontos (origem = prestador, destino = casa) ----
type ValhallaResponse = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: { shape?: string }[];
  };
};

export type Route = {
  distanceKm: number;
  durationMin: number;
  points: LatLng[] | null; // geometria da rota, já decodificada, p/ desenhar no mapa
};

// Decodifica a polyline do Valhalla (algoritmo padrão Google polyline, precisão 1e6).
// Decodificar no servidor evita levar um parser de polyline pro bundle nativo.
function decodePolyline6(encoded: string): LatLng[] {
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

    points.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }

  return points;
}

export async function routeBetween(from: LatLng, to: LatLng): Promise<Route | null> {
  const base = requireUrl(env.VALHALLA_URL, "VALHALLA_URL");
  const res = await fetch(`${base}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing: "auto",
      units: "kilometers",
    }),
  });
  if (!res.ok) throw new Error(`Valhalla ${res.status}`);
  const data = (await res.json()) as ValhallaResponse;
  const summary = data.trip?.summary;
  if (!summary) return null;
  const shape = data.trip?.legs?.[0]?.shape;
  return {
    distanceKm: summary.length ?? 0,
    durationMin: Math.round((summary.time ?? 0) / 60),
    points: shape ? decodePolyline6(shape) : null,
  };
}
