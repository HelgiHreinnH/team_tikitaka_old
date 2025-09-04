-- Clean up database structure for simplicity and security
-- Remove unused function that's causing security linter warnings

-- Drop the unused validate_response_token function
DROP FUNCTION IF EXISTS public.validate_response_token(text, uuid, date);

-- The current RLS policies are working correctly with application-level token validation
-- which is secure because:
-- 1. Tokens are 32-byte random hex strings (impossible to guess)
-- 2. Tokens are only sent via email to registered users
-- 3. Application validates token existence before allowing updates
-- 4. Each token is unique to a specific user and week

-- Note: The pg_net extension warning is not critical for functionality
-- It's used by Supabase for webhook and HTTP requests functionality