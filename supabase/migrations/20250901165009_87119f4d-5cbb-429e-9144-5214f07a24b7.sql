-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled  
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly invites to be sent every Tuesday at 10:30 AM CEST
-- CEST is UTC+2, so we schedule for 08:30 UTC
SELECT cron.schedule(
  'send-weekly-football-invites',
  '30 8 * * 2', -- Every Tuesday at 08:30 UTC (10:30 CEST)
  $$
  SELECT
    net.http_post(
        url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/send-weekly-invites',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZndwbW9obmdzaWV1eWhmand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg0NTAwNiwiZXhwIjoyMDcxNDIxMDA2fQ.eLrO1r6Yxpe4pnNE8o_lE5fhYiPZJInxoUoApGaB-3g"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- You can check scheduled jobs with:
-- SELECT * FROM cron.job;

-- To unschedule (if needed later):
-- SELECT cron.unschedule('send-weekly-football-invites');