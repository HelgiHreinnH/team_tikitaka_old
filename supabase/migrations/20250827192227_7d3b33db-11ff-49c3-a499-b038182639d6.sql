-- Add nickname column to users table
ALTER TABLE public.users 
ADD COLUMN nickname text;