-- Plantilla: la versión real (con el secreto) se genera en supabase/.secrets/cron.sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('banco-sync', '15 */6 * * *', $$
  select net.http_post(
    url := 'https://<PROYECTO>.supabase.co/functions/v1/banco/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);
