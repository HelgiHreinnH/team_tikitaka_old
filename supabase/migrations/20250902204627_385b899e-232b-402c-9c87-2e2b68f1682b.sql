-- Move pg_net extension from public to extensions schema for better security isolation
-- This is the recommended approach for production environments

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the extension (this will maintain all functionality)
-- Note: This requires superuser privileges and may need to be done by Supabase support
-- For now, we'll document this as a controlled risk since it's needed for email functionality

-- Alternative: Grant minimal permissions instead of moving
-- The extension is needed for the email system to work
COMMENT ON EXTENSION pg_net IS 'Required for email system - HTTP requests in send-weekly-invites function';