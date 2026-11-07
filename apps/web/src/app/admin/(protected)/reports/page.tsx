import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@judeu/ui/components/card";

import { REPORT_REASON_LABEL, listReports } from "@/lib/moderation";

import { reviewReport, updateUserBlocked } from "../../actions";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function AdminReportsPage() {
  const reports = await listReports();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Denúncias</h1>
      {reports.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma denúncia.</p>}
      {reports.map((r) => (
        <Card key={r.id} className={r.reason === "SAFETY" && r.status === "OPEN" ? "border-destructive" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {REPORT_REASON_LABEL[r.reason]} · contra {r.reportedName}
              {r.reportedBlocked && <span className="ml-2 text-xs text-destructive">SUSPENSO</span>}
            </CardTitle>
            <CardDescription>
              por {r.reporterName} · {fmt(r.createdAt)}
              {r.orderId ? ` · pedido #${r.orderId.slice(0, 8)}` : ""} ·{" "}
              {r.status === "OPEN" ? "aberta" : "revisada"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {r.details && <p className="text-xs whitespace-pre-wrap">{r.details}</p>}
            <div className="flex flex-wrap gap-2">
              <form action={updateUserBlocked.bind(null, r.reportedUserId, !r.reportedBlocked)}>
                <Button type="submit" size="sm" variant={r.reportedBlocked ? "outline" : "destructive"}>
                  {r.reportedBlocked ? "Reativar conta" : "Suspender conta"}
                </Button>
              </form>
              {r.status === "OPEN" && (
                <form action={reviewReport.bind(null, r.id)}>
                  <Button type="submit" size="sm" variant="outline">
                    Marcar como revisada
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
