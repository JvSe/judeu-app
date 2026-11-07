-- Fase 0: dispara POST /api/cron/tick a cada minuto (pg_cron + pg_net).
--
-- Antes de rodar, guarde a URL da API e o CRON_SECRET no Vault do Supabase
-- (uma vez por ambiente; NUNCA commite os valores):
--   select vault.create_secret('https://<api>/api/cron/tick', 'cron_tick_url');
--   select vault.create_secret('<mesmo valor de CRON_SECRET>', 'cron_secret');
--
-- Rodar só em staging até o merge na main.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('ajuda-cron-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ajuda-cron-tick');

SELECT cron.schedule(
  'ajuda-cron-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_tick_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
