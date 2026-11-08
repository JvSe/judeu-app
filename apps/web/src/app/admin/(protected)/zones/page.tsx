import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { listZones } from "@/lib/zones-db";
import { formatClock } from "@/lib/zones";

import { createServiceZone, removeServiceZone, toggleServiceZone } from "../../actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const inputClass = "rounded-md border bg-background px-2 py-1 text-sm";

// Zonas e horário de operação. Sem nenhuma zona ativa, o app atende em qualquer
// lugar e a qualquer hora (comportamento de antes).
export default async function AdminZonesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [zones, { error }] = await Promise.all([listZones(), searchParams]);
  const anyActive = zones.some((z) => z.active);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Zonas de atendimento</h1>
        <p className="text-sm text-muted-foreground">
          {anyActive
            ? "Só endereços dentro de uma zona ativa podem pedir. Fora do horário, o pedido precisa ser agendado."
            : "Nenhuma zona ativa: o app atende em qualquer lugar e a qualquer hora."}
        </p>
        <p className="text-sm text-muted-foreground">Horários no fuso de Brasília.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {zones.map((z) => (
        <Card key={z.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {z.name} {z.active ? "" : "(desativada)"}
            </CardTitle>
            <CardDescription>
              {z.weekdays.length === 7 ? "Todos os dias" : z.weekdays.map((d) => WEEKDAYS[d]).join(", ")} ·{" "}
              {formatClock(z.openMinute)}–{formatClock(z.closeMinute)} · {z.polygon.length} pontos
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={toggleServiceZone.bind(null, z.id, !z.active)}>
              <Button type="submit" size="sm" variant="outline">
                {z.active ? "Desativar" : "Ativar"}
              </Button>
            </form>
            <form action={removeServiceZone.bind(null, z.id)}>
              <Button type="submit" size="sm" variant="outline">
                Apagar
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nova zona</CardTitle>
          <CardDescription>
            Polígono: um ponto &quot;lat, lng&quot; por linha, ou cole um GeoJSON (ex.: desenhado no geojson.io).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createServiceZone} className="flex flex-col gap-3">
            <input name="name" required placeholder="Nome (ex.: Plano Diretor Sul)" className={inputClass} />
            <textarea
              name="polygon"
              required
              rows={6}
              placeholder={"-10.17, -48.35\n-10.17, -48.30\n-10.22, -48.30\n-10.22, -48.35"}
              className={`${inputClass} font-mono`}
            />
            <div className="flex flex-wrap gap-3 text-sm">
              {WEEKDAYS.map((label, i) => (
                <label key={label} className="flex items-center gap-1">
                  <input type="checkbox" name="weekday" value={i} defaultChecked />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              Das <input name="open" defaultValue="07:00" className={`${inputClass} w-20`} /> às{" "}
              <input name="close" defaultValue="22:00" className={`${inputClass} w-20`} />
            </div>
            <div>
              <Button type="submit" size="sm">
                Criar zona
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
