-- Create users table for team members
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weekly_responses table for attendance tracking
CREATE TABLE public.weekly_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('yes', 'maybe', 'no', 'no_response')) DEFAULT 'no_response',
  response_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_date)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for users table (public read, insert for new registrations)
CREATE POLICY "Users are publicly viewable" 
ON public.users 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own data" 
ON public.users 
FOR UPDATE 
USING (true);

-- Create policies for weekly_responses (public read, update via token)
CREATE POLICY "Weekly responses are publicly viewable" 
ON public.weekly_responses 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert weekly responses" 
ON public.weekly_responses 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update weekly responses" 
ON public.weekly_responses 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_responses_updated_at
  BEFORE UPDATE ON public.weekly_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_weekly_responses_week_date ON public.weekly_responses(week_date);
CREATE INDEX idx_weekly_responses_token ON public.weekly_responses(response_token);
CREATE INDEX idx_weekly_responses_user_week ON public.weekly_responses(user_id, week_date);