import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send, Activity, CheckCircle, AlertCircle } from "lucide-react";

type DiagnosticResult = {
  test: string;
  status: "success" | "error";
  message: string;
  details: string | null;
};

const Admin = () => {
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [sendingCustomEmail, setSendingCustomEmail] = useState(false);
  const [sendingWeeklyInvites, setSendingWeeklyInvites] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<DiagnosticResult[]>([]);
  
  // Custom email state
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailMessage, setCustomEmailMessage] = useState("");
  const [includeResponseLink, setIncludeResponseLink] = useState(false);

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

    } catch (error: any) {
      console.error('Error sending correction emails:', error);
      
      toast({
        title: "Error",
        description: "Failed to send correction emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingCorrection(false);
    }
  };

  const sendWeeklyInvites = async () => {
    setSendingWeeklyInvites(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-weekly-invites');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Weekly invites sent! 📧",
        description: `Successfully sent ${data.emailsSent || data.sent} invitations.`,
      });

    } catch (error: any) {
      console.error('Error sending weekly invites:', error);
      
      toast({
        title: "Error",
        description: "Failed to send weekly invites. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingWeeklyInvites(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagnosticsRunning(true);
    const results: DiagnosticResult[] = [];
    
    try {
      // Test database connection and count users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id');
      
      results.push({
        test: "Database Connection",
        status: usersError ? "error" : "success",
        message: usersError ? `Failed: ${usersError.message}` : "Success: Connected to database",
        details: usersError ? null : `${usersData?.length || 0} users in database`
      });

      // Test weekly responses table
      const { data: responsesData, error: responsesError } = await supabase
        .from('weekly_responses_public')
        .select('id');
      
      results.push({
        test: "Weekly Responses Table",
        status: responsesError ? "error" : "success",
        message: responsesError ? `Failed: ${responsesError.message}` : "Success: Table accessible",
        details: responsesError ? null : `${responsesData?.length || 0} total responses in database`
      });

      // Test current week data
      const currentWeek = new Date();
      const wednesday = new Date(currentWeek);
      wednesday.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 4) % 7));
      const weekDate = wednesday.toISOString().split('T')[0];
      
      const { data: weekData, error: weekError } = await supabase
        .from('weekly_responses_public')
        .select('id')
        .eq('week_date', weekDate);
      
      results.push({
        test: "Current Week Setup",
        status: weekError ? "error" : "success",
        message: weekError ? `Failed: ${weekError.message}` : `Success: Week ${weekDate} data found`,
        details: weekError ? null : `${weekData?.length || 0} responses for current week`
      });

    } catch (error: any) {
      results.push({
        test: "General System",
        status: "error",
        message: `System error: ${error.message}`,
        details: null
      });
    }

    setDiagnosticsResults(results);
    setDiagnosticsRunning(false);
    
    toast({
      title: "Diagnostics Complete",
      description: `${results.filter(r => r.status === 'success').length}/${results.length} tests passed`,
    });
  };

  const sendCustomEmail = async () => {
    if (!customEmailSubject.trim() || !customEmailMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message fields.",
        variant: "destructive"
      });
      return;
    }

    setSendingCustomEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-custom-email', {
        body: {
          subject: customEmailSubject,
          message: customEmailMessage,
          includeResponseLink: includeResponseLink
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Custom emails sent! 📧",
        description: `Successfully sent ${data.emailsSent} emails to users.`,
      });

      // Reset form
      setCustomEmailSubject("");
      setCustomEmailMessage("");
      setIncludeResponseLink(false);

    } catch (error: any) {
      console.error('Error sending custom emails:', error);
      
      toast({
        title: "Error",
        description: "Failed to send custom emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingCustomEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Operations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Operations
              </CardTitle>
              <CardDescription>
                Send emails to all registered users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={sendWeeklyInvites}
                disabled={sendingWeeklyInvites}
                className="w-full"
              >
                {sendingWeeklyInvites ? "Sending..." : "Send Weekly Invites"}
              </Button>
              
              <Button
                onClick={sendCorrectionEmail}
                disabled={sendingCorrection}
                variant="outline"
                className="w-full"
              >
                {sendingCorrection ? "Sending..." : "Send Correction Email"}
              </Button>
            </CardContent>
          </Card>

          {/* System Diagnostics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Diagnostics
              </CardTitle>
              <CardDescription>
                Check system health and database connectivity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runDiagnostics}
                disabled={diagnosticsRunning}
                className="w-full mb-4"
              >
                {diagnosticsRunning ? "Running..." : "Run Diagnostics"}
              </Button>
              
              {diagnosticsResults.length > 0 && (
                <div className="space-y-2">
                  {diagnosticsResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${
                        result.status === 'success' 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      {result.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{result.test}</div>
                        <div className="text-xs text-muted-foreground">{result.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Custom Email Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Custom Email
            </CardTitle>
            <CardDescription>
              Send a personalized message to all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={customEmailSubject}
                onChange={(e) => setCustomEmailSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
            
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={customEmailMessage}
                onChange={(e) => setCustomEmailMessage(e.target.value)}
                placeholder="Your message to the team..."
                rows={4}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="response-link"
                checked={includeResponseLink}
                onCheckedChange={setIncludeResponseLink}
              />
              <Label htmlFor="response-link">Include response buttons</Label>
            </div>
            
            <Button
              onClick={sendCustomEmail}
              disabled={sendingCustomEmail || !customEmailSubject.trim() || !customEmailMessage.trim()}
              className="w-full"
            >
              {sendingCustomEmail ? "Sending..." : "Send Custom Email"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Button variant="outline" asChild>
            <Link to="/whos-playing">View Attendance</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Admin;