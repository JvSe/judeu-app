// Resolve pra onde navegar a partir de uma notificação (push tocado ou item do
// centro de notificações, RF-I1/E2) — mesmo `data` gravado pelo servidor em
// orders.ts/chat.ts (`{ type, orderId, role }`). O app tem uma casca só
// (/client); `role` diz de que lado da chamada o destinatário está.
export type NotificationData = {
  type?: "order" | "chat" | "support" | "job" | "provider_status";
  orderId?: string;
  ticketId?: string;
  jobId?: string;
  role?: "client" | "provider" | "candidate";
};

export function pathForNotification(data: NotificationData): string | null {
  if (data.type === "job") {
    if (!data.jobId) return null;
    // Empresa dona da vaga vê os candidatos; candidato vê a vaga.
    return data.role === "provider"
      ? `/client/vaga/applicants/${data.jobId}`
      : `/jobs/${data.jobId}`;
  }
  // Cadastro de quem atende aprovado/bloqueado → perfil (mostra o status).
  if (data.type === "provider_status") return "/client/profile";
  if (data.type === "support") {
    if (!data.ticketId) return null;
    return `/client/support-ticket/${data.ticketId}`;
  }
  if (!data.orderId) return null;
  if (data.type === "chat") return `/client/chat/${data.orderId}`;
  if (data.type === "order") {
    // Quem atende vai pro mapa da chamada; quem pediu vai pro pagamento (a
    // tela redireciona aos detalhes quando já estiver pago).
    return data.role === "provider"
      ? `/client/attend/${data.orderId}`
      : `/client/payment/${data.orderId}`;
  }
  return null;
}
