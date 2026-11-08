import { CRON_JOBS } from ".";
import { runJobs } from "./runner";

// Cron local: o próprio servidor roda as tarefas a cada minuto (setInterval),
// sem pg_cron, sem chamada HTTP e sem CRON_SECRET. Serve para desenvolvimento
// e para servidor sempre ligado (ex.: Railway). Em hospedagem serverless (ex.:
// Vercel) não funciona: o processo dorme entre requisições — lá use o pg_cron (004).

const INTERVAL_MS = 60_000;
const FIRST_RUN_DELAY_MS = 10_000;

const state = globalThis as unknown as { __localCron?: { timer: ReturnType<typeof setInterval> } };

/** Ligado? `LOCAL_CRON=true|false` manda; sem a variável, só no `next dev`. */
export function isLocalCronEnabled(env: { LOCAL_CRON?: string; NODE_ENV?: string }): boolean {
  if (env.LOCAL_CRON === "true") return true;
  if (env.LOCAL_CRON === "false") return false;
  return env.NODE_ENV === "development";
}

export function startLocalCron(): void {
  if (state.__localCron) return; // hot reload do dev: um timer só
  let running = false;

  const tick = async () => {
    if (running) return; // rodada anterior ainda em andamento: pula esta
    running = true;
    try {
      const results = await runJobs(CRON_JOBS);
      // Só loga quando algo aconteceu ou falhou, para não poluir o terminal.
      const relevant = results.filter((r) => !r.ok || Object.values(r.summary).some((v) => v > 0));
      for (const r of relevant) {
        if (r.ok) console.log(`[cron local] ${r.name}:`, r.summary);
        else console.warn(`[cron local] ${r.name} falhou: ${r.error}`);
      }
    } catch (err) {
      console.error("[cron local] erro inesperado:", err);
    } finally {
      running = false;
    }
  };

  setTimeout(() => void tick(), FIRST_RUN_DELAY_MS);
  state.__localCron = { timer: setInterval(() => void tick(), INTERVAL_MS) };
  console.log("[cron local] ligado: tarefas a cada 1 min (LOCAL_CRON=false desliga)");
}
