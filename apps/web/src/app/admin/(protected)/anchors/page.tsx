import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { listAnchorCandidates, listShifts } from "@/lib/anchors-admin";
import { getConfig } from "@/lib/config";
import { formatBrasiliaDateTime } from "@/lib/zones";

import { cancelAnchorShift, createAnchorShift } from "../../actions";

export const dynamic = "force-dynamic";

const inputClass = "rounded-md border bg-background px-2 py-1 text-sm";
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_LABEL = { SCHEDULED: "Agendado / em andamento", SETTLED: "Fechado", CANCELLED: "Cancelado" } as const;

// Turnos de âncora: piso por hora disponível; a diferença vira complemento na carteira.
export default async function AdminAnchorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [shifts, candidates, config, { error }] = await Promise.all([
    listShifts(),
    listAnchorCandidates(),
    getConfig(),
    searchParams,
  ]);
  const totalSubsidy = shifts.reduce((sum, s) => sum + (s.subsidyCents ?? 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Âncoras e plantões</h1>
        <p className="text-sm text-muted-foreground">
          O piso conta só os minutos em que a pessoa ficou disponível (ou atendendo) no turno. Ao fim do turno (mais{" "}
          {config.anchorSettleGraceMin} min de folga), se o ganho dos pedidos aceitos no turno ficar abaixo do
          piso, a diferença entra na carteira. Complementos pagos nesta lista: {money(totalSubsidy)}.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Novo plantão</CardTitle>
          <CardDescription>Horários no fuso de Brasília. Se o fim for antes do início, vale o dia seguinte.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAnchorShift} className="flex flex-col gap-3 text-sm">
            <select name="providerId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Escolha quem atende
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isHelper ? "(ajudante)" : "(profissional)"}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              Dia <input type="date" name="date" required className={inputClass} />
              das <input name="start" defaultValue="08:00" className={`${inputClass} w-20`} />
              às <input name="end" defaultValue="14:00" className={`${inputClass} w-20`} />
            </div>
            <div className="flex items-center gap-2">
              Piso por hora (R$)
              <input
                name="floor"
                defaultValue={(config.anchorHourlyFloorCents / 100).toFixed(2).replace(".", ",")}
                className={`${inputClass} w-24`}
              />
            </div>
            <div>
              <Button type="submit" size="sm">
                Criar plantão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {shifts.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{s.providerName}</CardTitle>
            <CardDescription>
              {formatBrasiliaDateTime(s.startsAt)} → {formatBrasiliaDateTime(s.endsAt)} · {STATUS_LABEL[s.status]}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Piso {money(s.hourlyFloorCents)}/h · {s.onlineMinutes} min disponível · piso acumulado{" "}
              {money(s.floorCents)}
              {s.status === "SETTLED" &&
                ` · ganhou ${money(s.earnedCents ?? 0)} · complemento ${money(s.subsidyCents ?? 0)}`}
            </p>
            {s.status === "SCHEDULED" && (
              <form action={cancelAnchorShift.bind(null, s.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Cancelar plantão
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
