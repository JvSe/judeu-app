import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { ACCEPT_TARGET_MIN, loadMetricsReport } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;
const ACCEPT_GOAL = 0.85;

const CATEGORY_LABEL: Record<string, string> = {
  PAYMENT: "Pagamentos",
  CANCELLATION: "Cancelamento",
  SECURITY: "Segurança",
  ACCOUNT: "Conta e dados",
  DISPUTE: "Disputa",
  OTHER: "Outro",
};

const CHANNEL_LABEL: Record<string, string> = {
  indicacao: "Indicação",
  condominio: "Condomínio / síndico",
  redes_sociais: "Redes sociais",
  panfleto: "Panfleto / cartaz",
  parceiro_comercio: "Farmácia / mercado",
  outro: "Outro",
};

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const requested = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const report = await loadMetricsReport(days);
  const { acceptance, funnel, repurchase } = report;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Métricas do piloto</h1>
        <nav className="flex gap-3 text-sm">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={{ pathname: "/admin/metrics", query: { days: d } }}
              className={d === days ? "font-semibold underline" : "text-muted-foreground hover:underline"}
            >
              {d} dias
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={`Ajudas aceitas em < ${ACCEPT_TARGET_MIN} min`}
          value={pct(acceptance.rateUnder10)}
          hint={`${acceptance.under10} de ${acceptance.eligible} · meta ${pct(ACCEPT_GOAL)}`}
          warn={acceptance.rateUnder10 != null && acceptance.rateUnder10 < ACCEPT_GOAL}
        />
        <Stat
          label="Tempo mediano até o aceite"
          value={acceptance.medianMinutesToAccept == null ? "—" : `${acceptance.medianMinutesToAccept} min`}
          hint={`${acceptance.accepted} aceitas`}
        />
        <Stat
          label="Recompra em 30 dias"
          value={pct(repurchase.rate)}
          hint={`${repurchase.repurchased} de ${repurchase.cohort} clientes`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aceite por bairro (ajudas abertas)</CardTitle>
          <CardDescription>Só entram pedidos que já tiveram {ACCEPT_TARGET_MIN} min no ar.</CardDescription>
        </CardHeader>
        <CardContent>
          {acceptance.byNeighborhood.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem ajudas no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Bairro</th>
                  <th className="py-1 text-right">Pedidos</th>
                  <th className="py-1 text-right">&lt; {ACCEPT_TARGET_MIN} min</th>
                  <th className="py-1 text-right">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {acceptance.byNeighborhood.map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="py-1">{row.key}</td>
                    <td className="py-1 text-right tabular-nums">{row.total}</td>
                    <td className="py-1 text-right tabular-nums">{row.under10}</td>
                    <td
                      className={`py-1 text-right tabular-nums ${
                        row.rate != null && row.rate < ACCEPT_GOAL ? "text-destructive" : ""
                      }`}
                    >
                      {pct(row.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de pedidos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Row label="Criados" value={funnel.created} />
          <Row label="Aceitos" value={funnel.accepted} />
          <Row label="Concluídos" value={funnel.completed} />
          <Row label="Cancelados" value={`${funnel.cancelled} (${funnel.expired} expirados)`} />
          <Row label="Valor transacionado" value={money(funnel.gmvCents)} />
          <Row label="Receita da plataforma" value={money(funnel.platformRevenueCents)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidentes (chamados)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {report.incidents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum chamado no período.</p>
            ) : (
              report.incidents.map((i) => (
                <Row key={i.category} label={CATEGORY_LABEL[i.category] ?? i.category} value={i.count} />
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novos usuários por canal</CardTitle>
            <CardDescription>Divida o gasto de cada canal por estes números para obter o CAC.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {report.byChannel.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cadastro no período.</p>
            ) : (
              report.byChannel.map((c) => (
                <Row key={c.channel} label={CHANNEL_LABEL[c.channel] ?? c.channel} value={c.newClients} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl tabular-nums ${warn ? "text-destructive" : ""}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
