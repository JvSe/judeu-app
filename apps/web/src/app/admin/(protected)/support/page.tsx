import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";
import { Textarea } from "@judeu/ui/components/textarea";

import { listAllSupportTickets, type AdminSupportTicketDTO } from "@/lib/support";

import { claimSupportTicket, respondToSupportTicket } from "../../actions";

const STATUS_LABEL: Record<AdminSupportTicketDTO["status"], string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em análise",
  RESOLVED: "Respondido",
};

const CATEGORY_LABEL: Record<AdminSupportTicketDTO["category"], string> = {
  PAYMENT: "Pagamentos e reembolsos",
  CANCELLATION: "Cancelamento de pedido",
  SECURITY: "Segurança e verificação",
  ACCOUNT: "Minha conta e dados",
  DISPUTE: "Disputa / contestação de pedido",
  OTHER: "Outro assunto",
};

export default async function AdminSupportPage() {
  const tickets = await listAllSupportTickets();
  const pending = tickets.filter((t) => t.status !== "RESOLVED");
  const resolved = tickets.filter((t) => t.status === "RESOLVED");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum chamado aberto.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Respondidos ({resolved.length})
        </h2>
        {resolved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum chamado respondido ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {resolved.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: AdminSupportTicketDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ticket.subject}</CardTitle>
        <CardDescription>
          {ticket.userName} ({ticket.userEmail}) · {CATEGORY_LABEL[ticket.category]}
          {ticket.orderId ? ` · pedido #${ticket.orderId.slice(0, 8)}` : ""} ·{" "}
          {STATUS_LABEL[ticket.status]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs whitespace-pre-wrap">{ticket.message}</p>

        {ticket.adminResponse ? (
          <p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {ticket.adminResponse}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <form action={respondToSupportTicket.bind(null, ticket.id)} className="flex flex-col gap-2">
              <Textarea name="response" placeholder="Escreva a resposta para o usuário..." required />
              <Button type="submit" size="sm" className="self-start">
                Responder e concluir
              </Button>
            </form>
            {ticket.status === "OPEN" && (
              <form action={claimSupportTicket.bind(null, ticket.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Marcar em análise
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
