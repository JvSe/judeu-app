export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

function destinationPoint(origin: LatLng, distanceKm: number, bearingRad: number): LatLng {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

// Distância entre dois pontos (haversine), em km.
export function distanceKm(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Nunca posiciona uma empresa em cima da localização atual do usuário.
const MIN_DISTANCE_KM = 0.3;

// Reposiciona as empresas (dados mockados, sem geolocalização real) num raio
// ao redor da localização do usuário, nunca mais perto que MIN_DISTANCE_KM.
// Layout em espiral áurea (sunflower): densidade uniforme do mínimo até a
// borda, sem dois pontos se sobrepondo.
export function distributeNearby(center: LatLng, ids: string[], radiusKm = 4): Map<string, LatLng> {
  const sortedIds = [...ids].sort();
  const total = sortedIds.length;
  const positions = new Map<string, LatLng>();

  sortedIds.forEach((id, index) => {
    const spreadFraction = total > 1 ? Math.sqrt(index / (total - 1)) : 1;
    const distance = MIN_DISTANCE_KM + spreadFraction * (radiusKm - MIN_DISTANCE_KM);
    const bearingRad = index * GOLDEN_ANGLE_RAD;
    positions.set(id, destinationPoint(center, distance, bearingRad));
  });

  return positions;
}
