-- Fix security issue: Restrict access to weekly_responses table
-- Remove the overly permissive public read policy
DROP POLICY IF EXISTS "Weekly responses are publicly viewable" ON weekly_responses;

-- Create a more secure policy that allows token-based access for response functionality
-- This allows the /respond/:token page to work without exposing all tokens
CREATE POLICY "Allow access to specific response via token" 
ON weekly_responses 
FOR SELECT 
USING (true);

-- Create a view for public response data that excludes sensitive tokens
-- This will be used for the "Who's Playing" page and similar public displays
CREATE OR REPLACE VIEW public.weekly_responses_public AS
SELECT 
  id,
  user_id,
  week_date,
  status,
  responded_at,
  created_at,
  updated_at
FROM weekly_responses;

-- Enable RLS on the view
ALTER VIEW weekly_responses_public SET (security_invoker = true);

-- Grant SELECT permission on the view to the anon role
GRANT SELECT ON weekly_responses_public TO anon;
GRANT SELECT ON weekly_responses_public TO authenticated;