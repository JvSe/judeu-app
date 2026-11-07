// Formatos de cada provedor de geo, isolados em funções puras (testáveis sem
// rede). geo.ts escolhe o provedor pela env e faz o fetch.

export type LatLng = { lat: number; lng: number };

export type Route = {
  distanceKm: number;
  durationMin: number;
  points: LatLng[] | null; // geometria da rota, já decodificada, p/ desenhar no mapa
};

export type Geocoded = LatLng & { displayName: string };

// ---- Polyline (algoritmo do Google), precisão 1e5 (OSRM/Google) ou 1e6 (Valhalla) ----
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

export function decodePolyline6(encoded: string): LatLng[] {
  return decodePolyline(encoded, 1e6);
}

export function decodePolyline5(encoded: string): LatLng[] {
  return decodePolyline(encoded, 1e5);
}

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

// ---- OSRM: GET {base}/route/v1/driving/{lng,lat;lng,lat}?overview=full&geometries=polyline ----
export function osrmRouteUrl(base: string, from: LatLng, to: LatLng): URL {
  const url = new URL(`${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "polyline");
  return url;
}

export function parseOsrmRoute(data: {
  code?: string;
  routes?: { distance?: number; duration?: number; geometry?: string }[];
}): Route {
  if (data.code && data.code !== "Ok") throw new Error(`OSRM ${data.code}`);
  const route = data.routes?.[0];
  if (!route?.geometry) throw new Error("OSRM sem rota");
  return {
    distanceKm: (route.distance ?? 0) / 1000,
    durationMin: minutes(route.duration ?? 0),
    points: decodePolyline5(route.geometry),
  };
}

// ---- Valhalla: POST {base}/route ----
export function valhallaRouteBody(from: LatLng, to: LatLng) {
  return {
    locations: [
      { lat: from.lat, lon: from.lng },
      { lat: to.lat, lon: to.lng },
    ],
    costing: "auto",
    units: "kilometers",
    directions_type: "none",
  };
}

export function parseValhallaRoute(data: {
  trip?: { summary?: { length?: number; time?: number }; legs?: { shape?: string }[] };
}): Route {
  const trip = data.trip;
  if (!trip?.summary) throw new Error("Valhalla sem rota");
  const points = (trip.legs ?? []).flatMap((leg) => (leg.shape ? decodePolyline6(leg.shape) : []));
  return {
    distanceKm: trip.summary.length ?? 0,
    durationMin: minutes(trip.summary.time ?? 0),
    points: points.length ? points : null,
  };
}

// ---- Google Routes API: POST https://routes.googleapis.com/directions/v2:computeRoutes ----
export const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
export const GOOGLE_ROUTES_FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

export function googleRouteBody(from: LatLng, to: LatLng) {
  return {
    origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
    destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    languageCode: "pt-BR",
    units: "METRIC",
  };
}

export function parseGoogleRoute(data: {
  routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
}): Route {
  const route = data.routes?.[0];
  if (!route) throw new Error("Google sem rota");
  const seconds = Number.parseFloat((route.duration ?? "0s").replace("s", ""));
  const encoded = route.polyline?.encodedPolyline;
  return {
    distanceKm: (route.distanceMeters ?? 0) / 1000,
    durationMin: minutes(Number.isFinite(seconds) ? seconds : 0),
    points: encoded ? decodePolyline5(encoded) : null,
  };
}

// ---- Nominatim: GET {base}/search?format=jsonv2&countrycodes=br&limit=1&q= ----
export function nominatimSearchUrl(base: string, query: string): URL {
  const url = new URL(`${base}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  return url;
}

export function parseNominatim(results: { lat: string; lon: string; display_name: string }[]): Geocoded | null {
  const first = results[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name };
}

// ---- Google Geocoding: GET https://maps.googleapis.com/maps/api/geocode/json ----
export function googleGeocodeUrl(query: string, key: string): URL {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:BR");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", key);
  return url;
}

export function parseGoogleGeocode(data: {
  status?: string;
  results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[];
}): Geocoded | null {
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status && data.status !== "OK") throw new Error(`Google Geocoding ${data.status}`);
  const first = data.results?.[0];
  const loc = first?.geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng, displayName: first.formatted_address ?? "" };
}
