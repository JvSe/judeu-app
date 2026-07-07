import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { listAllProviderProfiles, type AdminProviderDTO } from "@/lib/provider-profile";

import { updateProviderStatus } from "../actions";

const STATUS_LABEL: Record<AdminProviderDTO["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  BLOCKED: "Bloqueado",
};

export default async function AdminDashboardPage() {
  const providers = await listAllProviderProfiles();
  const pending = providers.filter((p) => p.status === "PENDING");
  const others = providers.filter((p) => p.status !== "PENDING");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nada aguardando aprovação.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((p) => (
              <ProviderRow key={p.id} provider={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Todos os prestadores</h2>
        {others.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum outro prestador cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {others.map((p) => (
              <ProviderRow key={p.id} provider={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderRow({ provider }: { provider: AdminProviderDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{provider.fullName}</CardTitle>
        <CardDescription>
          {provider.email} · {provider.headline ?? "sem cadastro profissional"} ·{" "}
          {provider.categoryNames.join(", ") || "sem categoria"} · {provider.serviceCount}{" "}
          serviço(s) · {provider.hasDocument ? "documento enviado" : "sem documento"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <span className="text-xs font-medium">{STATUS_LABEL[provider.status]}</span>
        <div className="ml-auto flex gap-2">
          <form action={updateProviderStatus.bind(null, provider.id, "APPROVED")}>
            <Button type="submit" size="sm" disabled={provider.status === "APPROVED"}>
              Aprovar
            </Button>
          </form>
          <form action={updateProviderStatus.bind(null, provider.id, "BLOCKED")}>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={provider.status === "BLOCKED"}
            >
              Bloquear
            </Button>
          </form>
          {provider.status !== "PENDING" && (
            <form action={updateProviderStatus.bind(null, provider.id, "PENDING")}>
              <Button type="submit" size="sm" variant="outline">
                Voltar p/ pendente
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
