-- Consolidate and harden pg_cron jobs for weekly invites and weekly reset
-- Idempotent: safely recreates jobs with expected schedules and commands

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Constants
-- Note: This command uses the project's service role JWT embedded as in previous migrations.
-- Replace only if the project id or token changes.
DO $$
DECLARE
  v_jobid_invites integer;
  v_jobid_reset integer;
  v_command_invites text := $$
    SELECT net.http_post(
      url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/send-weekly-invites',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZndwbW9obmdzaWV1eWhmand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg0NTAwNiwiZXhwIjoyMDcxNDIxMDA2fQ.eLrO1r6Yxpe4pnNE8o_lE5fhYiPZJInxoUoApGaB-3g"}'::jsonb,
      body:='{"scheduled": true}'::jsonb
    );
  $$;
  v_command_reset text := $$
    SELECT net.http_post(
      url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/reset-weekly-responses',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZndwbW9obmdzaWV1eWhmand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg0NTAwNiwiZXhwIjoyMDcxNDIxMDA2fQ.eLrO1r6Yxpe4pnNE8o_lE5fhYiPZJInxoUoApGaB-3g"}'::jsonb,
      body:='{"scheduled": true}'::jsonb
    );
  $$;
BEGIN
  -- Look up existing jobs by name
  SELECT jobid INTO v_jobid_invites FROM cron.job WHERE jobname = 'send-weekly-football-invites';
  SELECT jobid INTO v_jobid_reset FROM cron.job WHERE jobname = 'reset-weekly-responses';

  -- Recreate invites job at Tuesday 08:30 UTC (10:30 CEST)
  IF v_jobid_invites IS NULL THEN
    PERFORM cron.schedule('send-weekly-football-invites', '30 8 * * 2', v_command_invites);
  ELSE
    PERFORM cron.alter(v_jobid_invites, schedule => '30 8 * * 2', command => v_command_invites, active => true);
  END IF;

  -- Recreate reset job at Thursday 11:00 UTC (13:00 CEST)
  IF v_jobid_reset IS NULL THEN
    PERFORM cron.schedule('reset-weekly-responses', '0 11 * * 4', v_command_reset);
  ELSE
    PERFORM cron.alter(v_jobid_reset, schedule => '0 11 * * 4', command => v_command_reset, active => true);
  END IF;
END $$;

-- Verification helpers (no-op when run via migration; for manual checks use the queries below)
-- SELECT jobid, jobname, schedule, active FROM cron.job
-- WHERE jobname IN ('send-weekly-football-invites','reset-weekly-responses');

