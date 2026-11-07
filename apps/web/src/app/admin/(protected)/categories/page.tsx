import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { RISK_LABEL, type RiskLevel } from "@/lib/risk";
import { listCategoriesWithRisk } from "@/lib/risk-admin";

import { updateCategoryRisk } from "../../actions";

export const dynamic = "force-dynamic";

// Níveis de tarefa por categoria. Toda categoria começa no nível 1.
export default async function AdminCategoriesPage() {
  const categories = await listCategoriesWithRisk();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Níveis de tarefa</h1>
        <p className="text-sm text-muted-foreground">
          Define quem pode atender cada categoria. Vale para pedidos criados depois da mudança.
        </p>
      </div>
      {categories.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{c.name}</CardTitle>
            <CardDescription>{RISK_LABEL[c.riskLevel]}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCategoryRisk.bind(null, c.id)} className="flex items-center gap-2">
              <select
                name="riskLevel"
                defaultValue={c.riskLevel}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {([1, 2, 3, 4] as RiskLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {l} · {RISK_LABEL[l]}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                Salvar
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
