-- Fix the security definer view warning by ensuring proper security invoker configuration
-- Drop and recreate views with proper security settings

DROP VIEW IF EXISTS weekly_responses_public;
DROP VIEW IF EXISTS users_public;

-- Recreate users_public view with explicit security invoker
CREATE VIEW public.users_public AS
SELECT 
  id,
  name,
  nickname,
  created_at
FROM users;

-- Set security invoker (uses caller's permissions, not definer's)
ALTER VIEW users_public SET (security_invoker = true);

-- Recreate weekly_responses_public view
CREATE VIEW public.weekly_responses_public AS
SELECT 
  wr.id,
  wr.user_id,
  wr.week_date,
  wr.status,
  wr.responded_at,
  wr.created_at,
  wr.updated_at,
  u.name as user_name,
  u.nickname as user_nickname
FROM weekly_responses wr
LEFT JOIN users_public u ON wr.user_id = u.id;

-- Set security invoker for this view as well
ALTER VIEW weekly_responses_public SET (security_invoker = true);

-- Grant necessary permissions
GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO authenticated;
GRANT SELECT ON weekly_responses_public TO anon;
GRANT SELECT ON weekly_responses_public TO authenticated;