import * as Location from "expo-location";
import { AppState, Platform } from "react-native";
import { useEffect, useRef, useState } from "react";

import {
  startOrderBackgroundTracking,
  stopOrderBackgroundTracking,
} from "@/lib/background-location";
import { useUpdateOrderLocation, useUpdateProviderLocation } from "@/lib/hooks";

export const FOREGROUND_LOCATION_WATCH = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 8000,
  distanceInterval: 25,
} as const;

// Chamada ativa: GPS de verdade. Balanced no iOS é precisão de ~100 m e quase não
// gera callbacks a pé; aqui o pin acompanha quem atende andando.
export const ACTIVE_ORDER_LOCATION_WATCH = {
  accuracy: Location.Accuracy.High,
  timeInterval: 4000,
  distanceInterval: 5,
} as const;

// Throttle do envio ao backend (cada POST recalcula rota/ETA).
const SEND_MIN_INTERVAL_MS = 4000;
const SEND_MIN_DISTANCE_M = 5;

export type LatLng = { lat: number; lng: number };

function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const FRESH_MS = 5 * 60 * 1000;

// Mesmo centro do mapa — só entra em __DEV__ quando o emulador não entrega GPS.
const DEV_FALLBACK_POSITION: LatLng = { lat: -10.1841, lng: -48.3336 };

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

function watchFirstFix(
  timeoutMs: number,
  accuracy: Location.Accuracy = Location.Accuracy.Balanced,
): Promise<LatLng | null> {
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
      { accuracy, timeInterval: 500, distanceInterval: 0, mayShowUserSettingsDialog: true },
      (pos) => finish(toLatLng(pos)),
    )
      .then((sub) => {
        if (settled) sub.remove();
        else subscription = sub;
      })
      .catch(() => finish(null));
  });
}

async function readCurrentPosition(
  timeoutMs: number,
  accuracy: Location.Accuracy,
): Promise<LatLng | null> {
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: true }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return toLatLng(pos);
  } catch {
    return null;
  }
}

async function warmAndroidNetworkProvider() {
  if (Platform.OS !== "android") return;
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    // Emulador / aparelho sem diálogo de precisão — segue sem bloquear.
  }
}

// Uma leitura só. Preferimos last-known fresco; senão pedimos fix atual e um
// watch curto. Em __DEV__, se o emulador não entregar GPS, cai em Palmas/TO.
export async function readForegroundPosition(): Promise<LatLng | null> {
  const known = await readLastKnown();
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      if (known?.point) return known.point;
      if (__DEV__) {
        console.warn("[location] serviços de localização desligados; fallback de desenvolvimento");
        return DEV_FALLBACK_POSITION;
      }
      return null;
    }
  } catch {
    if (known?.point) return known.point;
  }
  if (known?.fresh) return known.point;

  await warmAndroidNetworkProvider();

  // No Android o watch liga o provider; sem isso o geo fix do emulador não grava.
  const watched = await watchFirstFix(10000, Location.Accuracy.Balanced);
  if (watched) return watched;

  const current =
    (await readCurrentPosition(6000, Location.Accuracy.Low)) ??
    (await readCurrentPosition(6000, Location.Accuracy.Balanced));
  if (current) return current;

  if (known?.point) return known.point;

  if (__DEV__) {
    console.warn(
      "[location] GPS indisponível (comum em emulador sem fix); usando Palmas/TO em desenvolvimento",
    );
    return DEV_FALLBACK_POSITION;
  }
  return null;
}

// Posição ao vivo (foreground) — mapa durante a chamada (quem atende e cliente).
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
      const now = await readLastKnownPosition();
      if (!cancelled && now) setPosition(now);
      const sub = await Location.watchPositionAsync(ACTIVE_ORDER_LOCATION_WATCH, (pos) => {
        if (!cancelled) {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      });
      if (cancelled) sub.remove();
      else subscriptionRef.current = sub;
    })().catch((err) => console.warn("[location] useWatchCurrentLocation falhou:", err));

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  return position;
}

// Compartilha a posição de quem atende enquanto a chamada está ativa (RF-E3).
// Foreground: watch de alta precisão com throttle. Background (tela bloqueada,
// Waze aberto): task do expo-location, se o usuário concedeu "Sempre".
// Sem permissão ou fora de um pedido ativo, não faz nada (best-effort, RF-E2).
// Deve haver um único dono por app (hoje: a home), senão os POSTs duplicam.
export function useShareLocationWhileEnRoute(orderId: string | undefined) {
  const updateLocation = useUpdateOrderLocation();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!orderId) {
      void stopOrderBackgroundTracking();
      return;
    }
    let cancelled = false;
    let lastSent: { point: LatLng; at: number } | null = null;

    const report = (lat: number, lng: number, force = false) => {
      if (cancelled) return;
      // Em background quem envia é a task; evita POST em dobro.
      if (AppState.currentState !== "active") return;
      const point = { lat, lng };
      const now = Date.now();
      if (
        !force &&
        lastSent &&
        (now - lastSent.at < SEND_MIN_INTERVAL_MS ||
          distanceMeters(lastSent.point, point) < SEND_MIN_DISTANCE_M)
      ) {
        return;
      }
      lastSent = { point, at: now };
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
      if (now) report(now.lat, now.lng, true);

      const sub = await Location.watchPositionAsync(ACTIVE_ORDER_LOCATION_WATCH, (position) => {
        report(position.coords.latitude, position.coords.longitude);
      });
      if (cancelled) {
        sub.remove();
        return;
      }
      subscriptionRef.current = sub;

      void startOrderBackgroundTracking(orderId);
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
