import "@/unistyles";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import type { ReactElement } from "react";
import { useUnistyles } from "react-native-unistyles";

import { MapBackdrop } from "@/components/ui/map-backdrop";

// OpenFreeMap: tiles vetoriais grátis, sem chave, uso ilimitado (MIT).
// https://openfreemap.org — atribuição já incluída pelo controle nativo do MapLibre.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Centro de Palmas/TO — mesmo fallback usado no backend quando não há posição real.
const PALMAS_CENTER: [number, number] = [-48.3336, -10.1841];

type MapMarkerSpec = {
  id: string;
  lngLat: [number, number];
  render: () => ReactElement;
};

type RealMapProps = {
  markers?: MapMarkerSpec[];
  route?: { lat: number; lng: number }[] | null;
  center?: [number, number];
  zoom?: number;
  /** [west, south, east, north] — quando presente, a câmera enquadra os dois pontos. */
  bounds?: [number, number, number, number];
};

export const RealMap = ({ markers = [], route, center, bounds, zoom = 14 }: RealMapProps) => {
  const { theme } = useUnistyles();

  // Degradação graciosa: sem o style.json (ex.: sem rede na primeira carga), mantém
  // o backdrop decorativo em vez de uma tela de mapa quebrada.
  if (!MAP_STYLE_URL) {
    return <MapBackdrop />;
  }

  const routeGeoJson =
    route && route.length > 1
      ? {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: route.map((p) => [p.lng, p.lat]),
          },
        }
      : null;

  return (
    <Map mapStyle={MAP_STYLE_URL} style={{ flex: 1 }}>
      {bounds ? (
        <Camera
          bounds={bounds}
          padding={{ top: 120, bottom: 260, left: 60, right: 60 }}
        />
      ) : (
        <Camera center={center ?? PALMAS_CENTER} zoom={zoom} />
      )}

      {routeGeoJson && (
        <GeoJSONSource id="route" data={routeGeoJson}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": theme.colors.primary, "line-width": 4 }}
          />
        </GeoJSONSource>
      )}

      {markers.map((marker) => (
        <Marker key={marker.id} id={marker.id} lngLat={marker.lngLat}>
          {marker.render()}
        </Marker>
      ))}
    </Map>
  );
};
