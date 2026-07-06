// Utilitários de apresentação compartilhados pelas telas.
import type { OrderStatus } from "@/lib/api";

// Iniciais a partir do nome (ex.: "Carlos Mendes" -> "CM").
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Cor do avatar/marcador — o primeiro destaca em laranja, os demais em navy.
const AVATAR_COLORS = ["#FF6600", "#3a3a70"];
export function avatarColor(index: number): string {
  return index === 0 ? AVATAR_COLORS[0] : AVATAR_COLORS[1];
}

// Centavos -> "R$ 80".
export function priceFromCents(cents: number | null): string {
  if (cents == null) return "—";
  return `R$ ${Math.round(cents / 100)}`;
}

// Centavos -> "R$ 84,90" (com centavos).
export function moneyFromCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// Rótulo em pt-BR de cada estado do pedido.
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Aguardando",
  ACCEPTED: "Aceito",
  EN_ROUTE: "A caminho",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

// Um pedido "em andamento" ainda não terminou nem foi cancelado.
export function isOrderActive(status: OrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

// Hora curta a partir de um ISO ("14:02").
export function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
