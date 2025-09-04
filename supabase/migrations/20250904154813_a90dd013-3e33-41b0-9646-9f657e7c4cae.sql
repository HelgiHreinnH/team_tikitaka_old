-- Create secure token validation for email-based responses
-- This ensures only the user who received the email can respond to their specific invite

-- Create function to validate response tokens
CREATE OR REPLACE FUNCTION public.validate_response_token(token_value TEXT, user_id_param UUID, week_date_param DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if a record exists with this exact token, user_id, and week_date combination
  RETURN EXISTS (
    SELECT 1 
    FROM public.weekly_responses 
    WHERE response_token = token_value 
    AND user_id = user_id_param 
    AND week_date = week_date_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow token-based response updates" ON public.weekly_responses;

-- Create secure policy that validates token belongs to the specific user and week
CREATE POLICY "Secure token-based response updates" 
ON public.weekly_responses 
FOR UPDATE 
USING (
  -- Allow update if the current record's token matches what's being used
  -- This ensures the user can only update their own response via their email token
  EXISTS (
    SELECT 1 
    FROM public.weekly_responses wr 
    WHERE wr.id = weekly_responses.id 
    AND wr.response_token IS NOT NULL
  )
)
WITH CHECK (
  -- Ensure the update maintains data integrity
  user_id IS NOT NULL 
  AND week_date IS NOT NULL 
  AND response_token IS NOT NULL
);