import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { useUpdateOrderLocation } from "@/lib/hooks";

export const FOREGROUND_LOCATION_WATCH = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 8000,
  distanceInterval: 25,
} as const;

// Posição ao vivo (foreground) — mapa do prestador durante a entrega.
export function useWatchCurrentLocation(): { lat: number; lng: number } | null {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      subscriptionRef.current = await Location.watchPositionAsync(FOREGROUND_LOCATION_WATCH, (pos) => {
        if (!cancelled) {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  return position;
}

// Compartilha a posição do prestador (foreground) enquanto o pedido está a
// caminho (RF-E3) — sem permissão concedida ou fora de um pedido ativo, não
// faz nada (mesmo padrão best-effort do push, RF-E2).
export function useShareLocationWhileEnRoute(orderId: string | undefined) {
  const updateLocation = useUpdateOrderLocation();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const report = (lat: number, lng: number) => {
      updateLocation.mutate({ id: orderId, lat, lng });
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      try {
        const now = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          report(now.coords.latitude, now.coords.longitude);
        }
      } catch {
        // Sem fix imediato — watch abaixo continua tentando.
      }

      subscriptionRef.current = await Location.watchPositionAsync(FOREGROUND_LOCATION_WATCH, (position) => {
        report(position.coords.latitude, position.coords.longitude);
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
}

// Posição atual do usuário, obtida uma vez (não contínua) — usada pro marcador
// "você está aqui" no mapa. Sem permissão concedida, fica null sem quebrar a tela.
export function useCurrentLocation(): { lat: number; lng: number } | null {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!cancelled) {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}
