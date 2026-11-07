import { expireOrdersJob } from "./expire-orders";
import { overtimeAlertsJob } from "./overtime";
import { retentionJob } from "./retention";
import type { CronJob } from "./runner";

// Tarefas executadas a cada tick (1 min).
export const CRON_JOBS: CronJob[] = [expireOrdersJob, overtimeAlertsJob, retentionJob];
