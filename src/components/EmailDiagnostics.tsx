import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const EmailDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      console.log('Calling email-diagnostics function...');
      
      const { data, error } = await supabase.functions.invoke('email-diagnostics', {
        body: {}
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      console.log('Diagnostics result:', data);
      setResults(data);

      toast({
        title: "Diagnostics completed!",
        description: "Check the results below",
      });

    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      toast({
        title: "Diagnostics failed",
        description: error.message || "Failed to run email diagnostics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testEmail = async () => {
    setLoading(true);
    try {
      console.log('Testing send-test-email function...');
      
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { email: 'helgihreinn@me.com' }
      });

      if (error) {
        console.error('Test email error:', error);
        throw error;
      }

      console.log('Test email result:', data);

      toast({
        title: "Test email result",
        description: data?.message || "Check console for details",
      });

    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: "Test email failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Email System Diagnostics</h3>
      
      <div className="flex gap-2">
        <Button 
          onClick={runDiagnostics} 
          disabled={loading}
          variant="outline"
        >
          {loading ? "Running..." : "Run Diagnostics"}
        </Button>
        
        <Button 
          onClick={testEmail} 
          disabled={loading}
        >
          {loading ? "Sending..." : "Test Email Function"}
        </Button>
      </div>

      {results && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-2">Diagnostic Results:</h4>
          <pre className="text-sm overflow-auto whitespace-pre-wrap">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};