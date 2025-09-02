-- Fix security issue: Restrict access to users table personal information
-- Remove the overly permissive public read policy
DROP POLICY IF EXISTS "Users are publicly viewable" ON users;

-- Create a secure policy that only allows users to view their own data
-- This requires authentication and only shows user's own record
CREATE POLICY "Users can view own profile" 
ON users 
FOR SELECT 
TO authenticated
USING (auth.uid()::text = id::text);

-- Create a public view for non-sensitive user data needed for public functionality
-- This excludes email, phone and other sensitive information
CREATE OR REPLACE VIEW public.users_public AS
SELECT 
  id,
  name,
  nickname,
  created_at
FROM users;

-- Enable security invoker for the view (uses the permissions of the caller)
ALTER VIEW users_public SET (security_invoker = true);

-- Grant SELECT permission on the view to anon and authenticated roles
GRANT SELECT ON users_public TO anon;
GRANT SELECT ON users_public TO authenticated;

-- Also need to update the weekly_responses_public view to use the secure users view
DROP VIEW IF EXISTS weekly_responses_public;

CREATE OR REPLACE VIEW public.weekly_responses_public AS
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

-- Grant permissions on the updated view
GRANT SELECT ON weekly_responses_public TO anon;
GRANT SELECT ON weekly_responses_public TO authenticated;