SELECT cron.unschedule('ajuda-cron-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ajuda-cron-tick');
-- As extensões e os segredos do Vault ficam: podem ser usados por outras coisas.
