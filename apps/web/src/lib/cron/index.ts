import { anchorShiftsJob } from "./anchor-shifts";
import { escalateOpenJob } from "./escalate-open";
import { expireOrdersJob } from "./expire-orders";
import { overtimeAlertsJob } from "./overtime";
import { retentionJob } from "./retention";
import type { CronJob } from "./runner";
import { supportSlaJob } from "./support-sla";

// Tarefas executadas a cada tick (1 min).
export const CRON_JOBS: CronJob[] = [
  expireOrdersJob,
  escalateOpenJob,
  overtimeAlertsJob,
  supportSlaJob,
  retentionJob,
  anchorShiftsJob,
];
