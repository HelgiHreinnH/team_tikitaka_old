-- Optimize RLS to avoid per-row evaluation of auth functions
-- Wrap auth.uid() in scalar subqueries so it is treated as stable per statement

-- SELECT: Users can view their own profile
ALTER POLICY "Users can view own profile" ON public.users
USING ((SELECT auth.uid())::text = id::text);

-- UPDATE: Users can update their own profile (apply to both USING and WITH CHECK)
ALTER POLICY "Users can update own profile" ON public.users
USING ((SELECT auth.uid())::text = id::text)
WITH CHECK ((SELECT auth.uid())::text = id::text);


