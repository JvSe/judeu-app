import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import { useUpdateOrderLocation, useUpdateProviderLocation } from "@/lib/hooks";

export const FOREGROUND_LOCATION_WATCH = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 8000,
  distanceInterval: 25,
} as const;

export type LatLng = { lat: number; lng: number };

const FRESH_MS = 5 * 60 * 1000;

function toLatLng(pos: Location.LocationObject | null): LatLng | null {
  if (!pos) return null;
  const { latitude, longitude } = pos.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: latitude, lng: longitude };
}

async function readLastKnown(): Promise<{ point: LatLng; fresh: boolean } | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync();
    const point = toLatLng(pos);
    if (!pos || !point) return null;
    return { point, fresh: Date.now() - pos.timestamp < FRESH_MS };
  } catch {
    return null;
  }
}

export async function readLastKnownPosition(): Promise<LatLng | null> {
  const known = await readLastKnown();
  return known?.point ?? null;
}

function watchFirstFix(timeoutMs: number): Promise<LatLng | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: Location.LocationSubscription | null = null;
    const finish = (point: LatLng | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      resolve(point);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Low, timeInterval: 1000, distanceInterval: 0 },
      (pos) => finish(toLatLng(pos)),
    )
      .then((sub) => {
        if (settled) sub.remove();
        else subscription = sub;
      })
      .catch(() => finish(null));
  });
}

// Uma leitura só. O getCurrentPositionAsync do iOS falha com kCLErrorDomain 0
// quando ainda não há fix; a última posição e um watch curto cobrem esse caso.
export async function readForegroundPosition(): Promise<LatLng | null> {
  const known = await readLastKnown();
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return known?.point ?? null;
  } catch {
    return known?.point ?? null;
  }
  if (known?.fresh) return known.point;

  const watched = await watchFirstFix(6000);
  return watched ?? known?.point ?? null;
}

// Posição ao vivo (foreground) — mapa do prestador durante a entrega.
export function useWatchCurrentLocation(): { lat: number; lng: number } | null {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        console.warn("[location] useWatchCurrentLocation: permissão de localização negada");
        return;
      }
      subscriptionRef.current = await Location.watchPositionAsync(FOREGROUND_LOCATION_WATCH, (pos) => {
        if (!cancelled) {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      });
    })().catch((err) => console.warn("[location] useWatchCurrentLocation falhou:", err));

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
      updateLocation.mutate(
        { id: orderId, lat, lng },
        {
          onError: (err) => console.warn("[location] falha ao enviar posição do prestador:", err),
        },
      );
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        console.warn("[location] useShareLocationWhileEnRoute: permissão de localização negada");
        return;
      }

      const now = await readLastKnownPosition();
      if (!cancelled && now) report(now.lat, now.lng);

      subscriptionRef.current = await Location.watchPositionAsync(FOREGROUND_LOCATION_WATCH, (position) => {
        report(position.coords.latitude, position.coords.longitude);
      });
    })().catch((err) => console.warn("[location] useShareLocationWhileEnRoute falhou:", err));

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
      if (cancelled) return;
      if (status !== "granted") {
        console.warn("[location] useCurrentLocation: permissão de localização negada");
        return;
      }
      const result = await readForegroundPosition();
      if (!cancelled && result) setPosition(result);
    })().catch((err) => console.warn("[location] useCurrentLocation falhou:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}

// GPS ocioso: prestador online manda a posição para aparecer no mapa do cliente.
export function useShareIdleLocation(enabled: boolean) {
  const update = useUpdateProviderLocation();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const report = (lat: number, lng: number) => {
      update.mutate(
        { lat, lng },
        { onError: (err) => console.warn("[location] falha ao enviar GPS ocioso:", err) },
      );
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") return;
      const now = await readLastKnownPosition();
      if (!cancelled && now) report(now.lat, now.lng);
      subscriptionRef.current = await Location.watchPositionAsync(FOREGROUND_LOCATION_WATCH, (pos) => {
        report(pos.coords.latitude, pos.coords.longitude);
      });
    })().catch((err) => console.warn("[location] useShareIdleLocation falhou:", err));

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
