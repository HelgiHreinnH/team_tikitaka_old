-- Fix Function Search Path Mutable warning by setting explicit search_path
-- This prevents potential SQL injection attacks through search_path manipulation

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;