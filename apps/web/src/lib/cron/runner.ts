// Executor das tarefas do cron. Cada tarefa precisa ser idempotente: o tick pode
// rodar duas vezes no mesmo minuto ou pular um minuto sem estragar nada.

export type CronJob = {
  name: string;
  /** Devolve um resumo curto (ex.: quantos pedidos tocou), gravado no log do tick. */
  run: (now: Date) => Promise<Record<string, number> | void>;
};

export type CronJobResult =
  | { name: string; ok: true; ms: number; summary: Record<string, number> }
  | { name: string; ok: false; ms: number; error: string };

/** Roda as tarefas em sequência; a falha de uma não impede as outras. */
export async function runJobs(jobs: CronJob[], now = new Date()): Promise<CronJobResult[]> {
  const results: CronJobResult[] = [];
  for (const job of jobs) {
    const started = Date.now();
    try {
      const summary = (await job.run(now)) ?? {};
      results.push({ name: job.name, ok: true, ms: Date.now() - started, summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron] tarefa "${job.name}" falhou:`, message);
      results.push({ name: job.name, ok: false, ms: Date.now() - started, error: message });
    }
  }
  return results;
}
