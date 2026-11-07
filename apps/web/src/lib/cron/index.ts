import { expireOrdersJob } from "./expire-orders";
import type { CronJob } from "./runner";

// Tarefas executadas a cada tick (1 min).
export const CRON_JOBS: CronJob[] = [expireOrdersJob];
