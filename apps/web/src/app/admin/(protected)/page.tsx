import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { listAllProviderProfiles, type AdminProviderDTO } from "@/lib/provider-profile";
import { BADGE_LABEL, type BadgeType } from "@/lib/risk";
import { listBadgesByProvider } from "@/lib/risk-admin";

import { updateProviderBadge, updateProviderStatus } from "../actions";

const STATUS_LABEL: Record<AdminProviderDTO["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  BLOCKED: "Bloqueado",
};

export default async function AdminDashboardPage() {
  const [providers, badges] = await Promise.all([listAllProviderProfiles(), listBadgesByProvider()]);
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
              <ProviderRow key={p.id} provider={p} badges={badges.get(p.id) ?? []} />
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
              <ProviderRow key={p.id} provider={p} badges={badges.get(p.id) ?? []} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderRow({ provider, badges }: { provider: AdminProviderDTO; badges: BadgeType[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {provider.fullName}
          {provider.isCompany && provider.companyName ? ` · ${provider.companyName}` : ""}
        </CardTitle>
        <CardDescription>
          {provider.isCompany && (
            <>Responsável: {provider.responsibleName ?? "não informado"} · </>
          )}
          {provider.email} · {provider.isHelper ? "atende ajudas · " : ""}
          {provider.headline ?? "sem cadastro profissional"} ·{" "}
          {provider.categoryNames.join(", ") || "sem categoria"} · {provider.serviceCount}{" "}
          serviço(s) · {provider.hasDocument ? "documento enviado" : "sem documento"}
        </CardDescription>
      </CardHeader>
      <KycFiles provider={provider} />
      <CardContent className="flex items-center gap-2">
        <span className="text-xs font-medium">{STATUS_LABEL[provider.status]}</span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
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
          {(Object.keys(BADGE_LABEL) as BadgeType[]).map((type) => {
            const has = badges.includes(type);
            return (
              <form key={type} action={updateProviderBadge.bind(null, provider.id, type, !has)}>
                <Button type="submit" size="sm" variant={has ? "secondary" : "outline"}>
                  {has ? `✓ ${BADGE_LABEL[type]}` : `+ ${BADGE_LABEL[type]}`}
                </Button>
              </form>
            );
          })}
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

const isPdf = (url: string) => new URL(url).pathname.toLowerCase().endsWith(".pdf");

// Verificação: documento, selfie e antecedentes por links assinados (10 min).
function KycFiles({ provider }: { provider: AdminProviderDTO }) {
  const files = [
    { label: "Documento", url: provider.documentLink },
    { label: "Selfie", url: provider.selfieLink },
    { label: "Antecedentes", url: provider.backgroundCheckLink },
  ];
  return (
    <CardContent className="flex flex-wrap gap-3 pb-2">
      {files.map((f) =>
        f.url ? (
          <a key={f.label} href={f.url} target="_blank" rel="noreferrer" className="flex flex-col gap-1 text-xs">
            {isPdf(f.url) ? (
              <span className="flex h-24 w-24 items-center justify-center rounded border">PDF</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt={f.label} className="h-24 w-24 rounded border object-cover" />
            )}
            <span className="underline">{f.label}</span>
          </a>
        ) : (
          <div key={f.label} className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex h-24 w-24 items-center justify-center rounded border border-dashed">—</span>
            <span>{f.label}: não enviado</span>
          </div>
        ),
      )}
    </CardContent>
  );
}
