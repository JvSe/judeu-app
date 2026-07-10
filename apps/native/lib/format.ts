// Utilitários de apresentação compartilhados pelas telas.
import type { OrderStatus, SupportTicket, SupportTicketCategory } from "@/lib/api";

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

// Data+hora curtas ("Hoje, 14:02" ou "05/07, 14:02").
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const time = shortTime(iso);
  if (d.toDateString() === new Date().toDateString()) return `Hoje, ${time}`;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}, ${time}`;
}

// Tempo relativo curto ("agora", "há 5 min", "há 2h") — usado no centro de notificações.
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return shortDateTime(iso);
}

// Rótulo do grupo de data ("HOJE", "ONTEM" ou "05/07") pra agrupar listas por dia.
export function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "HOJE";
  if (d.toDateString() === yesterday.toDateString()) return "ONTEM";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// Central de ajuda/suporte + disputas (RF-H1/H2).
export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  PAYMENT: "Pagamentos e reembolsos",
  CANCELLATION: "Cancelamento de pedido",
  SECURITY: "Segurança e verificação",
  ACCOUNT: "Minha conta e dados",
  DISPUTE: "Disputa / problema com um pedido",
  OTHER: "Outro assunto",
};

export function supportCategoryLabel(category: SupportTicketCategory): string {
  return SUPPORT_CATEGORY_LABELS[category];
}

const SUPPORT_STATUS_LABELS: Record<SupportTicket["status"], string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em análise",
  RESOLVED: "Respondido",
};

export function supportStatusLabel(status: SupportTicket["status"]): string {
  return SUPPORT_STATUS_LABELS[status];
}
