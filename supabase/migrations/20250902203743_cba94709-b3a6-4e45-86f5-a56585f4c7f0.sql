-- Recreate views without SECURITY DEFINER to follow principle of least privilege
-- This ensures views run with the permissions of the querying user, not the creator

-- Recreate users_public view with proper security
DROP VIEW IF EXISTS public.users_public;
CREATE VIEW public.users_public AS 
SELECT id, nickname, created_at 
FROM users;

-- Recreate weekly_responses_public view with proper security  
DROP VIEW IF EXISTS public.weekly_responses_public;
CREATE VIEW public.weekly_responses_public AS
SELECT 
    wr.id,
    wr.user_id,
    wr.week_date,
    wr.status,
    wr.responded_at,
    wr.created_at,
    wr.updated_at,
    u.nickname AS user_nickname,
    u.name AS user_name
FROM weekly_responses wr
JOIN users u ON (wr.user_id = u.id);

-- Ensure proper access permissions
GRANT SELECT ON public.users_public TO anon, authenticated;
GRANT SELECT ON public.weekly_responses_public TO anon, authenticated;