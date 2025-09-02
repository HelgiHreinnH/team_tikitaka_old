-- Fix SECURITY DEFINER function by recreating without elevated privileges
-- This maintains the same functionality but runs with caller's permissions

DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Recreate the function without SECURITY DEFINER (default is SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Note: SECURITY INVOKER is the default and safer option
-- The function will run with the permissions of the user calling it