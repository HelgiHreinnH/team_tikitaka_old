import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const EmailTest = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendTestEmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { email: 'helgihreinn@me.com' }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Test email sent!",
        description: `Successfully sent test email to helgihreinn@me.com`,
      });

      console.log('Email test result:', data);
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: "Email failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Email Workflow Test</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Test the Resend email integration by sending a test email.
      </p>
      <Button 
        onClick={sendTestEmail} 
        disabled={loading}
        className="w-full"
      >
        {loading ? "Sending..." : "Send Test Email to helgihreinn@me.com"}
      </Button>
    </div>
  );
};