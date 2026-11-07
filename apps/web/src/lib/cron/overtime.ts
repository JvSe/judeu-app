import { randomUUID } from "node:crypto";

import { getConfig } from "../config";
import { ensureUtcIso } from "../dates";
import { supabase } from "../db";
import { notifyTrustedContact } from "../family";
import { notifyUser } from "../notifications";
import type { CronJob } from "./runner";

// Alerta de tempo excedido: serviço em andamento há mais que a duração
// prevista × overtimeAlertRatio. Avisa uma vez (overtimeAlertedAt).

export function isOvertime(
  startedAt: string | null,
  expectedMin: number,
  ratio: number,
  now: Date,
): boolean {
  if (!startedAt) return false;
  const elapsed = now.getTime() - new Date(ensureUtcIso(startedAt)).getTime();
  return elapsed > expectedMin * ratio * 60_000;
}

type Row = {
  id: string;
  clientId: string;
  expectedDurationMin: number | null;
  provider: { userId: string } | { userId: string }[] | null;
  events: { status: string; createdAt: string }[];
};

export const overtimeAlertsJob: CronJob = {
  name: "overtimeAlerts",
  async run(now) {
    const config = await getConfig();
    const { data, error } = await supabase
      .from("order")
      .select("id, clientId, expectedDurationMin, provider:providerprofile(userId), events:orderevent(status, createdAt)")
      .eq("status", "IN_PROGRESS")
      .is("overtimeAlertedAt", null)
      .limit(200);
    if (error) throw new Error(error.message);

    let alerted = 0;
    for (const raw of data ?? []) {
      const o = raw as unknown as Row;
      const started = o.events
        .filter((e) => e.status === "IN_PROGRESS")
        .map((e) => e.createdAt)
        .sort()[0] ?? null;
      const expected = o.expectedDurationMin ?? config.defaultExpectedDurationMin;
      if (!isOvertime(started, expected, config.overtimeAlertRatio, now)) continue;

      const { data: claimed } = await supabase
        .from("order")
        .update({ overtimeAlertedAt: now.toISOString() })
        .eq("id", o.id)
        .is("overtimeAlertedAt", null)
        .select("id");
      if (!claimed?.length) continue; // outro tick já avisou

      const provider = Array.isArray(o.provider) ? o.provider[0] : o.provider;
      const body = "O atendimento passou do tempo previsto. Está tudo bem? Se precisar, use o botão de emergência.";
      void notifyUser(o.clientId, "ORDER", {
        title: "Tudo certo por aí?",
        body,
        data: { type: "order", orderId: o.id, role: "client" },
      });
      if (provider) {
        void notifyUser(provider.userId, "ORDER", {
          title: "Atendimento passou do tempo previsto",
          body: "Se já terminou, toque em 'Terminei'. Se precisar de ajuda, use o botão de emergência.",
          data: { type: "order", orderId: o.id, role: "provider" },
        });
      }
      void notifyTrustedContact(o.id, "overtime");
      await supabase.from("supportticket").insert({
        id: randomUUID(),
        userId: o.clientId,
        orderId: o.id,
        category: "SECURITY",
        subject: "Tempo excedido no atendimento",
        message: `Atendimento em andamento há mais de ${Math.round(expected * config.overtimeAlertRatio)} min (previsto: ${expected} min). Alerta automático.`,
        updatedAt: now.toISOString(),
      });
      alerted += 1;
    }
    return { alerted };
  },
};
