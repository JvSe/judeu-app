import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";

import { ApiError, ordersApi } from "@/lib/api";

// Envia a posição de quem atende com o app em background (tela bloqueada, Waze
// aberto). Em foreground quem envia é o watch de `useShareLocationWhileEnRoute`;
// aqui a task ignora para não duplicar POSTs.
export const ORDER_LOCATION_TASK = "order-location-background";

const ACTIVE_ORDER_KEY = "ajuda.activeOrderId";
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

type TaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask<TaskData>(ORDER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[bg-location] erro na task:", error.message);
    return;
  }
  if (AppState.currentState === "active") return;

  const locations = data?.locations ?? [];
  const last = locations[locations.length - 1];
  if (!last) return;

  let orderId: string | null = null;
  try {
    orderId = await SecureStore.getItemAsync(ACTIVE_ORDER_KEY, STORE_OPTIONS);
  } catch {
    return;
  }
  if (!orderId) {
    await stopOrderBackgroundTracking();
    return;
  }

  try {
    await ordersApi.updateLocation(orderId, last.coords.latitude, last.coords.longitude);
  } catch (err) {
    // Sessão encerrada ou pedido encerrado/reatribuído: nada mais a compartilhar.
    if (err instanceof ApiError && [401, 403, 404, 409].includes(err.status)) {
      await stopOrderBackgroundTracking();
      return;
    }
    console.warn("[bg-location] falha ao enviar posição:", err);
  }
});

// Serializa start/stop: o effect do hook pode parar e reiniciar em sequência.
let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>): Promise<void> {
  queue = queue.then(job).catch((err) => console.warn("[bg-location]", err));
  return queue;
}

async function isTaskAvailable(): Promise<boolean> {
  try {
    return await TaskManager.isAvailableAsync();
  } catch {
    return false;
  }
}

async function ensureBackgroundPermission(): Promise<boolean> {
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const asked = await Location.requestBackgroundPermissionsAsync();
  return asked.status === "granted";
}

// Best-effort: sem permissão "Sempre" (ou em Expo Go) segue só com o foreground.
export function startOrderBackgroundTracking(orderId: string): Promise<void> {
  return enqueue(async () => {
    if (!(await isTaskAvailable())) return;
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return;

    await SecureStore.setItemAsync(ACTIVE_ORDER_KEY, orderId, STORE_OPTIONS);

    if (await Location.hasStartedLocationUpdatesAsync(ORDER_LOCATION_TASK)) return;
    if (!(await ensureBackgroundPermission())) {
      console.warn("[bg-location] permissão de background negada; só foreground");
      return;
    }

    await Location.startLocationUpdatesAsync(ORDER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      activityType: Location.ActivityType.OtherNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Compartilhando sua localização",
        notificationBody: "O cliente acompanha você até o fim do atendimento",
        notificationColor: "#FF6600",
      },
    });
  });
}

export function stopOrderBackgroundTracking(): Promise<void> {
  return enqueue(async () => {
    try {
      await SecureStore.deleteItemAsync(ACTIVE_ORDER_KEY, STORE_OPTIONS);
    } catch {
      // segue para parar a task mesmo assim
    }
    if (!(await isTaskAvailable())) return;
    if (await Location.hasStartedLocationUpdatesAsync(ORDER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(ORDER_LOCATION_TASK);
    }
  });
}
