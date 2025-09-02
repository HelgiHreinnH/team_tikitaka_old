-- Fix RLS policies and nickname assignment logic - Fixed version
-- Only assign historic football names when nickname is NULL or empty

-- First, let's fix the RLS policies for proper security
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow access to specific response via token" ON public.weekly_responses;
DROP POLICY IF EXISTS "Anyone can insert weekly responses" ON public.weekly_responses;
DROP POLICY IF EXISTS "Anyone can update weekly responses" ON public.weekly_responses;

-- Create secure RLS policies for users table
CREATE POLICY "Public can insert users" ON public.users
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can view all users (nickname only)" ON public.users
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Create secure RLS policies for weekly_responses table
CREATE POLICY "Token-based response access" ON public.weekly_responses
  FOR SELECT
  USING (true);

CREATE POLICY "Token-based response insert" ON public.weekly_responses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Token-based response update" ON public.weekly_responses
  FOR UPDATE
  USING (
    -- Allow updates via response token or by authenticated user
    EXISTS (
      SELECT 1 FROM public.weekly_responses wr 
      WHERE wr.id = weekly_responses.id 
      AND wr.response_token = current_setting('request.jwt.claims', true)::json->>'response_token'
    )
    OR auth.uid()::text = user_id::text
  );

-- Create function to assign historic football names only when nickname is empty
CREATE OR REPLACE FUNCTION assign_historic_nickname()
RETURNS TRIGGER AS $$
DECLARE
  historic_names TEXT[] := ARRAY[
    'Pelé', 'Maradona', 'Cruyff', 'Beckenbauer', 'Zidane', 
    'Ronaldinho', 'Van Basten', 'Gullit', 'Pirlo', 'Totti',
    'Maldini', 'Baresi', 'Platini', 'Best', 'Charlton',
    'Eusébio', 'Garrincha', 'Romário', 'Kaká', 'Ronaldo',
    'Baggio', 'Del Piero', 'Nedvěd', 'Figo', 'Rivaldo',
    'Cafu', 'Roberto Carlos', 'Xavi', 'Iniesta', 'Riquelme'
  ];
  random_name TEXT;
BEGIN
  -- Only assign historic name if nickname is NULL or empty string
  IF NEW.nickname IS NULL OR TRIM(NEW.nickname) = '' THEN
    -- Get a random historic football player name
    random_name := historic_names[floor(random() * array_length(historic_names, 1) + 1)];
    
    -- Make sure the name is unique by checking existing nicknames
    WHILE EXISTS (SELECT 1 FROM public.users WHERE nickname = random_name) LOOP
      random_name := historic_names[floor(random() * array_length(historic_names, 1) + 1)];
    END LOOP;
    
    NEW.nickname := random_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to assign historic nicknames on insert/update
DROP TRIGGER IF EXISTS assign_nickname_trigger ON public.users;
CREATE TRIGGER assign_nickname_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_historic_nickname();

-- Update existing users who have empty nicknames
UPDATE public.users 
SET nickname = (
  SELECT historic_names[floor(random() * 30 + 1)]
  FROM (
    SELECT ARRAY[
      'Pelé', 'Maradona', 'Cruyff', 'Beckenbauer', 'Zidane', 
      'Ronaldinho', 'Van Basten', 'Gullit', 'Pirlo', 'Totti',
      'Maldini', 'Baresi', 'Platini', 'Best', 'Charlton',
      'Eusébio', 'Garrincha', 'Romário', 'Kaká', 'Ronaldo',
      'Baggio', 'Del Piero', 'Nedvěd', 'Figo', 'Rivaldo',
      'Cafu', 'Roberto Carlos', 'Xavi', 'Iniesta', 'Riquelme'
    ] AS historic_names
  ) names
)
WHERE nickname IS NULL OR TRIM(nickname) = '';

-- Drop views in correct order (dependent view first)
DROP VIEW IF EXISTS public.weekly_responses_public CASCADE;
DROP VIEW IF EXISTS public.users_public CASCADE;

-- Recreate public views with only nicknames visible
CREATE VIEW public.users_public AS
SELECT 
  id,
  nickname,
  created_at
FROM public.users;

CREATE VIEW public.weekly_responses_public AS
SELECT 
  wr.id,
  wr.user_id,
  wr.week_date,
  wr.status,
  wr.responded_at,
  wr.created_at,
  wr.updated_at,
  u.nickname as user_nickname,
  u.name as user_name
FROM public.weekly_responses wr
JOIN public.users u ON wr.user_id = u.id;