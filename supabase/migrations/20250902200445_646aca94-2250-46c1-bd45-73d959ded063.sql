-- Fix security issues from linter
-- 1. Fix search_path for function
ALTER FUNCTION assign_historic_nickname() SET search_path = public;

-- 2. Fix views to not be security definer (recreate without security definer)
-- Drop and recreate views without any special privileges
-- Views are inherently public readable anyway since they don't have RLS enabled