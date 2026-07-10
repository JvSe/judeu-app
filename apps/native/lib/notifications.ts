// Resolve pra onde navegar a partir de uma notificação (push tocado ou item do
// centro de notificações, RF-I1/E2) — mesmo `data` gravado pelo servidor em
// orders.ts/chat.ts (`{ type, orderId, role }`).
export type NotificationData = {
  type?: "order" | "chat" | "support";
  orderId?: string;
  ticketId?: string;
  role?: "client" | "provider";
};

export function pathForNotification(data: NotificationData): string | null {
  if (data.type === "support") {
    if (!data.ticketId) return null;
    return data.role === "provider"
      ? `/provider/support-ticket/${data.ticketId}`
      : `/client/support-ticket/${data.ticketId}`;
  }
  if (!data.orderId) return null;
  if (data.type === "chat") {
    return data.role === "provider" ? `/provider/chat/${data.orderId}` : `/client/chat/${data.orderId}`;
  }
  if (data.type === "order") {
    return data.role === "provider" ? "/provider" : `/client/order/${data.orderId}`;
  }
  return null;
}
