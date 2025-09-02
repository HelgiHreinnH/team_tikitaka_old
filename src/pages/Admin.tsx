import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Activity } from "lucide-react";

const Admin = () => {
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any[]>([]);

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

  const runDiagnostics = async () => {
    setDiagnosticsRunning(true);
    const results = [];
    
    try {
      // Test database connection
      console.log("Testing database connection...");
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      results.push({
        test: "Database Connection",
        status: usersError ? "error" : "success",
        message: usersError ? `Failed: ${usersError.message}` : `Success: Connected to database`,
        details: usersError ? null : `${usersData?.length || 0} users in database`
      });

      // Test weekly responses table
      console.log("Testing weekly responses table...");
      const { data: responsesData, error: responsesError } = await supabase
        .from('weekly_responses')
        .select('count', { count: 'exact', head: true });
      
      results.push({
        test: "Weekly Responses Table",
        status: responsesError ? "error" : "success",
        message: responsesError ? `Failed: ${responsesError.message}` : `Success: Table accessible`,
        details: responsesError ? null : `${responsesData?.length || 0} responses in database`
      });

      // Test email function connection
      console.log("Testing email function connection...");
      try {
        const { data: emailTest, error: emailError } = await supabase.functions.invoke('send-correction-email', {
          body: { action: 'test_connection' }
        });
        
        results.push({
          test: "Email Function",
          status: emailError ? "error" : "success",
          message: emailError ? `Failed: ${emailError.message}` : "Success: Function accessible",
          details: emailError ? null : "Email function ready to send"
        });
      } catch (emailFuncError) {
        results.push({
          test: "Email Function",
          status: "error",
          message: `Failed: ${emailFuncError.message}`,
          details: null
        });
      }

      // Test user flow by checking if current week data exists
      console.log("Testing current week data...");
      const currentWeek = new Date();
      const wednesday = new Date(currentWeek);
      wednesday.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 4) % 7));
      const weekDate = wednesday.toISOString().split('T')[0];
      
      const { data: weekData, error: weekError } = await supabase
        .from('weekly_responses')
        .select('*')
        .eq('week_date', weekDate);
      
      results.push({
        test: "Current Week Setup",
        status: weekError ? "error" : "success",
        message: weekError ? `Failed: ${weekError.message}` : `Success: Week ${weekDate} data found`,
        details: weekError ? null : `${weekData?.length || 0} responses for current week`
      });

    } catch (error) {
      results.push({
        test: "General System",
        status: "error",
        message: `System error: ${error.message}`,
        details: null
      });
    }

    setDiagnosticsResults(results);
    setDiagnosticsRunning(false);
    
    // Add to logs
    const logEntry = `${new Date().toISOString()}: System diagnostics completed - ${results.filter(r => r.status === 'success').length}/${results.length} tests passed`;
    setLogs(prev => [logEntry, ...prev]);
    
    toast({
      title: "Diagnostics Complete",
      description: `${results.filter(r => r.status === 'success').length}/${results.length} tests passed`,
    });
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
          {/* System Diagnostics */}
          <Card>
            <CardHeader>
              <CardTitle>🔍 System Diagnostics</CardTitle>
              <CardDescription>
                Check database connections, email services, and userflow functionality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Connection & Flow Tests</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run comprehensive tests to verify all systems are working correctly.
                  </p>
                  <Button 
                    onClick={runDiagnostics}
                    disabled={diagnosticsRunning}
                    className="w-full mb-4"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {diagnosticsRunning ? "Running Diagnostics..." : "Run System Diagnostics"}
                  </Button>
                  
                  {diagnosticsResults.length > 0 && (
                    <div className="space-y-2">
                      {diagnosticsResults.map((result, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                          {result.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{result.test}</div>
                            <div className="text-xs text-muted-foreground">{result.message}</div>
                            {result.details && (
                              <div className="text-xs text-muted-foreground mt-1">{result.details}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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