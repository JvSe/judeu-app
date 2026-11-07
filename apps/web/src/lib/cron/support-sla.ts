import { env } from "@judeu/env/server";

import { supabase } from "../db";
import { sendEmail } from "../mailer";
import type { CronJob } from "./runner";

// Suporte 24 h: chamado sem resposta depois do prazo é escalado uma vez
// (e-mail para SECURITY_ALERT_EMAIL; o painel marca como atrasado).
export const supportSlaJob: CronJob = {
  name: "supportSla",
  async run(now) {
    const { data, error } = await supabase
      .from("supportticket")
      .update({ escalatedAt: now.toISOString() })
      .neq("status", "RESOLVED")
      .is("escalatedAt", null)
      .lt("slaDueAt", now.toISOString())
      .select("id, category, subject, orderId");
    if (error) throw new Error(error.message);
    const escalated = data ?? [];
    if (escalated.length && env.SECURITY_ALERT_EMAIL) {
      await sendEmail({
        to: env.SECURITY_ALERT_EMAIL,
        subject: `[Ajuda+] ${escalated.length} chamado(s) passaram do prazo`,
        body: escalated
          .map((t) => `• [${t.category}] ${t.subject}${t.orderId ? ` (pedido ${t.orderId})` : ""}`)
          .join("\n"),
      }).catch((err) => console.error("[cron] e-mail de escalonamento falhou:", err));
    }
    return { escalated: escalated.length };
  },
};
