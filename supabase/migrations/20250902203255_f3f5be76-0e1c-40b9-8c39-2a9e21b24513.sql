-- Enable real-time for weekly_responses table
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_responses;

-- Set REPLICA IDENTITY FULL to capture complete row data for real-time updates
ALTER TABLE weekly_responses REPLICA IDENTITY FULL;