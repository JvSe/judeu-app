import type { Order } from "./api";
import { distanceKm } from "./nearby";

/** Mesmo TTL do backend (waiting / offerExpiresAt em open request). */
export const OPEN_REQUEST_TTL_MS = 4 * 60 * 60 * 1000;

export type IncomingWorkOptions = {
  /** Modo atender ligado: libera as ajudas abertas (pedidos no ar). */
  isOn: boolean;
  /** Tem perfil de quem atende: chamadas diretas aparecem mesmo com o modo desligado. */
  acceptsDirect: boolean;
  origin: { lat: number; lng: number } | null;
  radiusKm: number;
  now?: number;
};

// Chamadas que podem aparecer no mapa para quem atende (lista `useOrders("provider")`):
// - ajuda aberta (isOpenRequest, ainda sem prestador) dentro do raio e do TTL, só com o modo ligado;
// - chamada direta (cliente escolheu este prestador) em CREATED, sempre que houver perfil.
export function filterIncomingWork(orders: Order[], opts: IncomingWorkOptions): Order[] {
  const now = opts.now ?? Date.now();
  return orders.filter((order) => {
    if (order.status !== "CREATED") return false;
    if (!order.isOpenRequest) return opts.acceptsDirect;
    if (!opts.isOn || order.provider) return false;
    const age = now - new Date(order.createdAt).getTime();
    if (!Number.isFinite(age) || age > OPEN_REQUEST_TTL_MS) return false;
    // Conta só o que está perto da posição atual do mapa (mesmo critério do raio).
    if (opts.origin) {
      const d = distanceKm(opts.origin, { lat: order.address.lat, lng: order.address.lng });
      if (d > opts.radiusKm) return false;
    }
    return true;
  });
}
