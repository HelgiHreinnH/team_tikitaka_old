-- Schedule weekly response reset to run every Thursday at 1:00 PM CEST
-- CEST is UTC+2, so we schedule for 11:00 UTC
SELECT cron.schedule(
  'reset-weekly-responses',
  '0 11 * * 4', -- Every Thursday at 11:00 UTC (13:00 CEST)
  $$
  SELECT
    net.http_post(
        url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/reset-weekly-responses',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZndwbW9obmdzaWV1eWhmand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg0NTAwNiwiZXhwIjoyMDcxNDIxMDA2fQ.eLrO1r6Yxpe4pnNE8o_lE5fhYiPZJInxoUoApGaB-3g"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- You can check all scheduled jobs with:
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;