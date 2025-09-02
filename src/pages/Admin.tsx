import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const Admin = () => {
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const sendCorrectionEmail = async () => {
    setSendingCorrection(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-correction-email');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Correction emails sent! 📧",
        description: "All users have been notified about the email fix.",
      });

      // Add to logs
      const logEntry = `${new Date().toISOString()}: Correction emails sent successfully - ${JSON.stringify(data)}`;
      setLogs(prev => [logEntry, ...prev]);
    } catch (error) {
      console.error('Error sending correction emails:', error);
      const logEntry = `${new Date().toISOString()}: ERROR sending correction emails - ${error.message}`;
      setLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: "Error",
        description: "Failed to send correction emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingCorrection(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      // Get function logs from Supabase analytics
      const { data, error } = await supabase.functions.invoke('send-correction-email', {
        body: { action: 'get_logs' }
      });
      
      if (data) {
        const logEntry = `${new Date().toISOString()}: Logs retrieved - Function response: ${JSON.stringify(data)}`;
        setLogs(prev => [logEntry, ...prev]);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      const logEntry = `${new Date().toISOString()}: ERROR loading logs - ${error.message}`;
      setLogs(prev => [logEntry, ...prev]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const currentLog = logs.length > 0 ? logs[0] : "No recent activity";

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Main
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <div className="grid gap-6">
          {/* Email Management */}
          <Card>
            <CardHeader>
              <CardTitle>📧 Email Management</CardTitle>
              <CardDescription>
                Send corrective emails and manage email communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Send Correction Email</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send a corrective email to all users explaining that the email link fix has been implemented.
                  </p>
                  <Button 
                    onClick={sendCorrectionEmail}
                    disabled={sendingCorrection}
                    className="w-full"
                  >
                    {sendingCorrection ? "Sending..." : "Send Correction Email to All Users"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Viewer */}
          <Card>
            <CardHeader>
              <CardTitle>📋 System Logs</CardTitle>
              <CardDescription>
                View recent system activity and function logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* One Line Log Display */}
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-sm font-mono truncate">
                    {currentLog}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={loadLogs}>
                        {isLoadingLogs ? "Loading..." : "View Details"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>System Logs</DialogTitle>
                        <DialogDescription>
                          Recent activity and function execution logs
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                        <div className="space-y-2">
                          {logs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No logs available</p>
                          ) : (
                            logs.map((log, index) => (
                              <div key={index} className="text-xs font-mono p-2 rounded bg-muted/50">
                                {log}
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;