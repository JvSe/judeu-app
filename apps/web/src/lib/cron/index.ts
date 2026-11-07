import type { CronJob } from "./runner";

// Tarefas executadas a cada tick (1 min). Vazia na Fase 0: a infraestrutura
// existe, mas nenhum comportamento muda até uma fase registrar a sua tarefa aqui.
export const CRON_JOBS: CronJob[] = [];
