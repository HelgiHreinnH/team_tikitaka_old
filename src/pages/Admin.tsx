import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Activity, Mail, BarChart3 } from "lucide-react";

const Admin = () => {
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any[]>([]);
  const [resendDiagnosticsRunning, setResendDiagnosticsRunning] = useState(false);
  const [resendData, setResendData] = useState<any>(null);

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
        .from('weekly_responses_public')
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
        .from('weekly_responses_public')
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

  const getResendDiagnostics = async () => {
    setResendDiagnosticsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-diagnostics');
      
      if (error) {
        throw error;
      }
      
      setResendData(data.data);
      
      toast({
        title: "Resend Diagnostics Retrieved",
        description: `Found ${data.data.emailStats.total} total emails, ${data.data.todaysEmails} sent today`,
      });

      // Add to logs
      const logEntry = `${new Date().toISOString()}: Resend diagnostics retrieved - ${data.data.emailStats.total} total emails, ${data.data.todaysEmails} today`;
      setLogs(prev => [logEntry, ...prev]);
    } catch (error) {
      console.error('Error getting Resend diagnostics:', error);
      const logEntry = `${new Date().toISOString()}: ERROR getting Resend diagnostics - ${error.message}`;
      setLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: "Error",
        description: "Failed to get Resend diagnostics. Please try again.",
        variant: "destructive"
      });
    } finally {
      setResendDiagnosticsRunning(false);
    }
  };

  const currentLog = logs.length > 0 ? logs[0] : "No recent activity";

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Button variant="ghost" asChild className="self-start">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Main
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Panel</h1>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {/* System Diagnostics */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">🔍 System Diagnostics</CardTitle>
              <CardDescription className="text-sm">
                Check database connections, email services, and userflow functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-4">
                <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Connection & Flow Tests</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    Run comprehensive tests to verify all systems are working correctly.
                  </p>
                  <Button 
                    onClick={runDiagnostics}
                    disabled={diagnosticsRunning}
                    className="btn-primary"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {diagnosticsRunning ? "Running Diagnostics..." : "Run System Diagnostics"}
                  </Button>
                  
                  {diagnosticsResults.length > 0 && (
                    <div className="space-y-2">
                      {diagnosticsResults.map((result, index) => (
                        <div key={index} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg bg-background">
                          {result.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs sm:text-sm">{result.test}</div>
                            <div className="text-xs text-muted-foreground break-words">{result.message}</div>
                            {result.details && (
                              <div className="text-xs text-muted-foreground mt-1 break-words">{result.details}</div>
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
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">📧 Email Management</CardTitle>
              <CardDescription className="text-sm">
                Send corrective emails and manage email communications
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-4">
                <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Send Correction Email</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    Send a corrective email to all users explaining that the email link fix has been implemented.
                  </p>
                  <Button 
                    onClick={sendCorrectionEmail}
                    disabled={sendingCorrection}
                    className="btn-primary"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingCorrection ? "Sending..." : "Send Correction Mail to Admin"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resend Diagnostics */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">📊 Resend Email Diagnostics</CardTitle>
              <CardDescription className="text-sm">
                View Resend service statistics and email delivery information
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-4">
                <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Email Service Analytics</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    Get detailed statistics about email delivery, domains, and recent activity from Resend.
                  </p>
                  <Button 
                    onClick={getResendDiagnostics}
                    disabled={resendDiagnosticsRunning}
                    className="btn-primary mb-4"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {resendDiagnosticsRunning ? "Fetching Data..." : "Get Resend Diagnostics"}
                  </Button>
                  
                  {resendData && (
                    <div className="space-y-4">
                      {/* Email Statistics */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                        <div className="p-2 sm:p-3 border rounded-lg bg-background">
                          <div className="text-xs sm:text-sm font-semibold">Total Emails</div>
                          <div className="text-lg sm:text-2xl font-bold text-primary">{resendData.emailStats.total}</div>
                        </div>
                        <div className="p-2 sm:p-3 border rounded-lg bg-background">
                          <div className="text-xs sm:text-sm font-semibold">Sent</div>
                          <div className="text-lg sm:text-2xl font-bold text-green-500">{resendData.emailStats.sent}</div>
                        </div>
                        <div className="p-2 sm:p-3 border rounded-lg bg-background">
                          <div className="text-xs sm:text-sm font-semibold">Delivered</div>
                          <div className="text-lg sm:text-2xl font-bold text-blue-500">{resendData.emailStats.delivered}</div>
                        </div>
                        <div className="p-2 sm:p-3 border rounded-lg bg-background">
                          <div className="text-xs sm:text-sm font-semibold">Today</div>
                          <div className="text-lg sm:text-2xl font-bold text-purple-500">{resendData.todaysEmails}</div>
                        </div>
                      </div>

                      {/* Domains */}
                      {resendData.domains && resendData.domains.length > 0 && (
                        <div className="p-3 sm:p-4 border rounded-lg bg-background">
                          <h5 className="font-semibold mb-2 text-sm sm:text-base">Configured Domains</h5>
                          <div className="space-y-2">
                            {resendData.domains.map((domain: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                                <span className="truncate">{domain.name}</span>
                                <span className={`px-2 py-1 rounded text-xs flex-shrink-0 ${
                                  domain.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {domain.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Emails */}
                      {resendData.recentEmails && resendData.recentEmails.length > 0 && (
                        <div className="p-3 sm:p-4 border rounded-lg bg-background">
                          <h5 className="font-semibold mb-2 text-sm sm:text-base">Recent Emails</h5>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {resendData.recentEmails.map((email: any, index: number) => (
                              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm p-2 border rounded gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{email.subject}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    To: {Array.isArray(email.to) ? email.to.join(', ') : email.to}
                                  </div>
                                </div>
                                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 sm:gap-1">
                                  <div className={`px-2 py-1 rounded text-xs flex-shrink-0 ${
                                    email.status === 'sent' ? 'bg-green-100 text-green-700' : 
                                    email.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {email.status}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(email.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Viewer */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">📋 System Logs</CardTitle>
              <CardDescription className="text-sm">
                View recent system activity and function logs
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-4">
                {/* One Line Log Display */}
                <div className="flex items-start gap-2 p-2 sm:p-3 border rounded-lg bg-background">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs sm:text-sm font-mono truncate min-w-0">
                    {currentLog}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={loadLogs}>
                        {isLoadingLogs ? "Loading..." : "View Details"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[80vh] w-full">
                      <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl">System Logs</DialogTitle>
                        <DialogDescription className="text-sm">
                          Recent activity and function execution logs
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-[70vh] sm:h-[60vh] w-full rounded-md border p-2 sm:p-4">
                        <div className="space-y-2">
                          {logs.length === 0 ? (
                            <p className="text-xs sm:text-sm text-muted-foreground">No logs available</p>
                          ) : (
                            logs.map((log, index) => (
                              <div key={index} className="text-xs font-mono p-2 rounded bg-muted/50 break-all">
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