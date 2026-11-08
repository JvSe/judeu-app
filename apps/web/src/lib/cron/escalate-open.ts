import { escalateOpenRequests } from "../orders";
import type { CronJob } from "./runner";

// Ajuda aberta sem aceite: avisa âncoras de plantão e depois amplia o raio.
export const escalateOpenJob: CronJob = {
  name: "escalateOpenRequests",
  run: (now) => escalateOpenRequests(now),
};
