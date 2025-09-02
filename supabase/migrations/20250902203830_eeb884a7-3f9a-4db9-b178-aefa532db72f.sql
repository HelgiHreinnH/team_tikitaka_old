-- Fix SECURITY DEFINER by recreating the function safely
-- We need to drop and recreate triggers since they depend on the function

-- Step 1: Drop the triggers temporarily
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_weekly_responses_updated_at ON weekly_responses;

-- Step 2: Drop and recreate the function without SECURITY DEFINER
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Note: Default is SECURITY INVOKER (safer than SECURITY DEFINER)

-- Step 3: Recreate the triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_responses_updated_at
  BEFORE UPDATE ON weekly_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();