// Roda uma vez quando o servidor do Next sobe.
export async function register() {
  // Só no runtime Node (o Edge não tem setInterval de longa duração nem acesso ao banco).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isLocalCronEnabled, startLocalCron } = await import("./lib/cron/local");
  if (isLocalCronEnabled(process.env)) startLocalCron();
}
