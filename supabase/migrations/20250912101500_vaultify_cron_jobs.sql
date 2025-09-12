-- Use Supabase Vault for Authorization header in pg_cron jobs
-- This migration removes hardcoded JWTs and reads from vault.decrypted_secrets

-- Prereqs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Optional: Secret bootstrap (DO NOT COMMIT REAL SECRETS)
-- To set the secret in prod, run separately:
--   SELECT vault.create_secret('service_role_key', '<SERVICE_ROLE_JWT>');
-- Or:
--   INSERT INTO vault.secrets(name, secret) VALUES ('service_role_key', '<SERVICE_ROLE_JWT>')
--   ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

DO $$
DECLARE
  v_jobid_invites integer;
  v_jobid_reset integer;
  v_bearer text := 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '');
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_bearer);
  v_command_invites text;
  v_command_reset text;
BEGIN
  -- Fail early if secret missing to avoid creating broken jobs
  IF v_bearer = 'Bearer ' THEN
    RAISE EXCEPTION 'Vault secret service_role_key is missing. Please create it before running this migration.';
  END IF;

  v_command_invites := format($FMT$
    SELECT net.http_post(
      url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/send-weekly-invites',
      headers:=%L::jsonb,
      body:='{"scheduled": true}'::jsonb
    );
  $FMT$, v_headers::text);

  v_command_reset := format($FMT$
    SELECT net.http_post(
      url:='https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/reset-weekly-responses',
      headers:=%L::jsonb,
      body:='{"scheduled": true}'::jsonb
    );
  $FMT$, v_headers::text);

  -- Reconcile jobs with Vault-powered headers
  SELECT jobid INTO v_jobid_invites FROM cron.job WHERE jobname = 'send-weekly-football-invites';
  IF v_jobid_invites IS NULL THEN
    PERFORM cron.schedule('send-weekly-football-invites', '30 8 * * 2', v_command_invites);
  ELSE
    PERFORM cron.alter(v_jobid_invites, schedule => '30 8 * * 2', command => v_command_invites, active => true);
  END IF;

  SELECT jobid INTO v_jobid_reset FROM cron.job WHERE jobname = 'reset-weekly-responses';
  IF v_jobid_reset IS NULL THEN
    PERFORM cron.schedule('reset-weekly-responses', '0 11 * * 4', v_command_reset);
  ELSE
    PERFORM cron.alter(v_jobid_reset, schedule => '0 11 * * 4', command => v_command_reset, active => true);
  END IF;
END $$;

