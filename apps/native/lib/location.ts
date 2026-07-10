import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { useUpdateOrderLocation } from "@/lib/hooks";

// Compartilha a posição do prestador (foreground) enquanto o pedido está a
// caminho (RF-E3) — sem permissão concedida ou fora de um pedido ativo, não
// faz nada (mesmo padrão best-effort do push, RF-E2).
export function useShareLocationWhileEnRoute(orderId: string | undefined) {
  const updateLocation = useUpdateOrderLocation();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 25 },
        (position) => {
          updateLocation.mutate({
            id: orderId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
      );
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
