import "@/unistyles";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import type { ReactElement } from "react";
import { Pressable } from "react-native";
import { useUnistyles } from "react-native-unistyles";

import { MapBackdrop } from "@/components/ui/map-backdrop";

// OpenFreeMap: tiles vetoriais grátis, sem chave, uso ilimitado (MIT).
// https://openfreemap.org — logo e botão de informação ficam fora da interface.
const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";

// Centro de Palmas/TO — mesmo fallback usado no backend quando não há posição real.
export const PALMAS_CENTER: [number, number] = [-48.3336, -10.1841];

type MapMarkerSpec = {
  id: string;
  lngLat: [number, number];
  render: () => ReactElement;
  onPress?: () => void;
};

type RealMapProps = {
  markers?: MapMarkerSpec[];
  route?: { lat: number; lng: number }[] | null;
  center?: [number, number];
  zoom?: number;
  /** [west, south, east, north] — quando presente, a câmera enquadra os dois pontos. */
  bounds?: [number, number, number, number];
  /** Estilo claro (liberty) ou escuro — default dark. */
  variant?: "dark" | "light";
  /** Força a câmera a reaplicar o centro (ex.: botão "minha localização"). */
  cameraKey?: number | string;
};

export const RealMap = ({
  markers = [],
  route,
  center,
  bounds,
  zoom = 14,
  variant = "dark",
  cameraKey = 0,
}: RealMapProps) => {
  const { theme } = useUnistyles();
  const mapStyle = variant === "light" ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;

  // Degradação graciosa: sem o style.json (ex.: sem rede na primeira carga), mantém
  // o backdrop decorativo em vez de uma tela de mapa quebrada.
  if (!mapStyle) {
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
    <Map mapStyle={mapStyle} style={{ flex: 1 }} attribution={false} logo={false}>
      {bounds ? (
        <Camera
          key={`bounds-${cameraKey}`}
          bounds={bounds}
          padding={{ top: 120, bottom: 260, left: 60, right: 60 }}
        />
      ) : (
        <Camera key={`center-${cameraKey}`} center={center ?? PALMAS_CENTER} zoom={zoom} />
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
          {marker.onPress ? (
            <Pressable onPress={marker.onPress}>{marker.render()}</Pressable>
          ) : (
            marker.render()
          )}
        </Marker>
      ))}
    </Map>
  );
};
