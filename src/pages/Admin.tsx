import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Activity, Mail, BarChart3, Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type DiagnosticResult = {
  test: string;
  status: "success" | "error";
  message: string;
  details: string | null;
};

type ResendEmailStats = {
  total: number;
  sent: number;
  delivered: number;
};

type ResendDomain = {
  name: string;
  status: string;
};

type RecentEmail = {
  subject: string;
  to: string | string[];
  status: string;
  created_at: string;
};

type ResendDiagnostics = {
  emailStats: ResendEmailStats;
  todaysEmails: number;
  domains?: ResendDomain[];
  recentEmails?: RecentEmail[];
};

const Admin = () => {
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<DiagnosticResult[]>([]);
  const [resendDiagnosticsRunning, setResendDiagnosticsRunning] = useState(false);
  const [resendData, setResendData] = useState<ResendDiagnostics | null>(null);
  
  // Custom email state
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailMessage, setCustomEmailMessage] = useState("");
  const [includeResponseLink, setIncludeResponseLink] = useState(false);
  const [sendingCustomEmail, setSendingCustomEmail] = useState(false);

  // Global email operation/rate limiting state
  const [emailOperationInProgress, setEmailOperationInProgress] = useState(false);
  const [nextAllowedEmailTime, setNextAllowedEmailTime] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState<number>(0);
  const cooldownMsRef = useRef<number>(5000); // cooldown after any email op
  const minGapMsRef = useRef<number>(1000); // minimum 1s between requests

  // Client-side rate tracking (educational UI, 2 req/s target)
  const RATE_LIMIT_PER_SEC = 2;
  const DEQUEUE_INTERVAL_MS = 500; // 2 per second
  const [requestTimestamps, setRequestTimestamps] = useState<number[]>([]);
  const [currentRatePerSec, setCurrentRatePerSec] = useState<number>(0);
  const [isWithinLimit, setIsWithinLimit] = useState<boolean>(true);

  // Local operation queue for batch-safe sending (send-test-email)
  const [queue, setQueue] = useState<string[]>([]);
  const [isQueueActive, setIsQueueActive] = useState<boolean>(false);
  const dispatchTimerRef = useRef<number | null>(null);
  const lastDispatchAtRef = useRef<number>(0);
  const [batchSending, setBatchSending] = useState<boolean>(false);
  const [batchTotal, setBatchTotal] = useState<number>(0);
  const [batchSent, setBatchSent] = useState<number>(0);
  const [batchEmailsText, setBatchEmailsText] = useState<string>("");

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const recordClientRequest = () => {
    const now = Date.now();
    setRequestTimestamps((prev) => {
      const next = [...prev, now].filter((t) => now - t <= 1000);
      return next;
    });
  };

  const waitUntilEmailAllowed = async () => {
    const now = Date.now();
    if (nextAllowedEmailTime && now < nextAllowedEmailTime) {
      await sleep(nextAllowedEmailTime - now);
    }
  };

  const beginEmailOperation = async () => {
    if (emailOperationInProgress) {
      return false;
    }
    setEmailOperationInProgress(true);
    await waitUntilEmailAllowed();
    return true;
  };

  const endEmailOperationWithCooldown = () => {
    const now = Date.now();
    // Ensure at least 1s between requests, plus cooldown
    const nextTime = now + Math.max(minGapMsRef.current, cooldownMsRef.current);
    setNextAllowedEmailTime(nextTime);
    setEmailOperationInProgress(false);
  };

  // Countdown updater
  useEffect(() => {
    const i = setInterval(() => {
      if (!nextAllowedEmailTime) {
        setCountdownMs(0);
        return;
      }
      const remaining = Math.max(0, nextAllowedEmailTime - Date.now());
      setCountdownMs(remaining);
      if (remaining === 0) {
        setNextAllowedEmailTime(null);
      }
    }, 250);
    return () => clearInterval(i);
  }, [nextAllowedEmailTime]);

  // Update current request rate and compliance indicator
  useEffect(() => {
    const i = setInterval(() => {
      const now = Date.now();
      setRequestTimestamps((prev) => prev.filter((t) => now - t <= 1000));
      setCurrentRatePerSec((prevTs) => {
        const count = requestTimestamps.length;
        setIsWithinLimit(count <= RATE_LIMIT_PER_SEC);
        return count;
      });
    }, 250);
    return () => clearInterval(i);
  }, [requestTimestamps.length]);

  const sendTestEmail = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { email }
      });
      recordClientRequest();
      if (error) throw error;
      const statusText = data?.queued ? `Queued (202) for ${email}` : `Sent (200) to ${email}`;
      const logEntry = `${new Date().toISOString()}: Test email ${statusText}`;
      setLogs((prev) => [logEntry, ...prev]);
    } catch (err: unknown) {
      recordClientRequest();
      const e = err as { status?: number; message?: string } | undefined;
      const isRateLimited = e?.status === 429 || /rate limit|too many/i.test(e?.message || "");
      const logEntry = `${new Date().toISOString()}: ERROR sending test email to ${email} - ${e?.message || 'Unknown error'}`;
      setLogs((prev) => [logEntry, ...prev]);
      toast({
        title: isRateLimited ? "Rate limited" : "Error",
        description: isRateLimited ? "Too many requests. The queue will keep spacing out sends automatically." : "Failed to send test email.",
        variant: "destructive",
      });
    }
  };

  // Queue processor: dequeue and send every 500ms (2 req/s)
  useEffect(() => {
    if (dispatchTimerRef.current) return; // already running
    dispatchTimerRef.current = window.setInterval(async () => {
      if (queue.length === 0) return;
      const now = Date.now();
      const sinceLast = now - lastDispatchAtRef.current;
      if (sinceLast < DEQUEUE_INTERVAL_MS) return;
      const [nextEmail, ...rest] = queue;
      setQueue(rest);
      setIsQueueActive(true);
      lastDispatchAtRef.current = now;
      await sendTestEmail(nextEmail);
      setBatchSent((s) => s + 1);
      if (rest.length === 0) {
        setIsQueueActive(false);
        setBatchSending(false);
      }
    }, 100);
    return () => {
      if (dispatchTimerRef.current) {
        clearInterval(dispatchTimerRef.current);
        dispatchTimerRef.current = null;
      }
    };
  }, [queue.length]);

  const sendCorrectionEmail = async () => {
    // Prevent parallel or too-frequent requests
    const started = await beginEmailOperation();
    if (!started) {
      toast({
        title: "Please wait",
        description: "An email operation is already in progress.",
      });
      return;
    }
    setSendingCorrection(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-correction-email');
      recordClientRequest();
      
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
    } catch (error: unknown) {
      const e = error as { status?: number; message?: string } | undefined;
      console.error('Error sending correction emails:', error);
      const isRateLimited = e?.status === 429 || /rate limit/i.test(e?.message || "");
      const logEntry = `${new Date().toISOString()}: ERROR sending correction emails - ${e?.message || 'Unknown error'}`;
      setLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: isRateLimited ? "Rate limited" : "Error",
        description: isRateLimited ? "Too many requests. Please wait for the cooldown." : "Failed to send correction emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingCorrection(false);
      endEmailOperationWithCooldown();
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

  const sendCustomEmail = async () => {
    if (!customEmailSubject.trim() || !customEmailMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message fields.",
        variant: "destructive"
      });
      return;
    }

    // Prevent parallel or too-frequent requests
    const started = await beginEmailOperation();
    if (!started) {
      toast({
        title: "Please wait",
        description: "An email operation is already in progress.",
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
      recordClientRequest();

      if (error) {
        throw error;
      }

      toast({
        title: "Custom emails sent! 📧",
        description: `Successfully sent ${data.emailsSent} emails to users.`,
      });

      // Add to logs
      const logEntry = `${new Date().toISOString()}: Custom emails sent - ${JSON.stringify(data)}`;
      setLogs(prev => [logEntry, ...prev]);

      // Reset form
      setCustomEmailSubject("");
      setCustomEmailMessage("");
      setIncludeResponseLink(false);

    } catch (error: unknown) {
      const e = error as { status?: number; message?: string } | undefined;
      console.error('Error sending custom emails:', error);
      const isRateLimited = e?.status === 429 || /rate limit/i.test(e?.message || "");
      const logEntry = `${new Date().toISOString()}: ERROR sending custom emails - ${e?.message || 'Unknown error'}`;
      setLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: isRateLimited ? "Rate limited" : "Error",
        description: isRateLimited ? "Too many requests. Please wait for the cooldown." : "Failed to send custom emails. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingCustomEmail(false);
      endEmailOperationWithCooldown();
    }
  };

  const currentLog = logs.length > 0 ? logs[0] : "No recent activity";

  const isInEmailCooldown = !!nextAllowedEmailTime && Date.now() < (nextAllowedEmailTime || 0);
  const secondsLeft = Math.ceil(countdownMs / 1000);
  const nextSlotMs = Math.max(0, DEQUEUE_INTERVAL_MS - (Date.now() - lastDispatchAtRef.current));
  const ratePct = Math.min(100, Math.round((currentRatePerSec / RATE_LIMIT_PER_SEC) * 100));

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
          {/* Rate Limit & Queue Status */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">⏱️ Rate Limit & Queue Status</CardTitle>
              <CardDescription className="text-sm">
                This app respects a provider limit of 2 requests per second. Operations are spaced automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${isWithinLimit ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs sm:text-sm">
                      {isWithinLimit ? 'Within limit' : 'At/over limit'} • Current rate: {currentRatePerSec}/{RATE_LIMIT_PER_SEC} req/s
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next queue slot in ~{Math.ceil(nextSlotMs / 100) / 10}s • Queue: {queue.length} pending
                  </div>
                </div>
                <Progress value={ratePct} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  Tip: If you try to send too fast, we will queue and spread requests to avoid violations.
                </div>
              </div>
            </CardContent>
          </Card>
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
                    disabled={sendingCorrection || emailOperationInProgress || isInEmailCooldown}
                    className="btn-primary"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingCorrection
                      ? "Sending..."
                      : (emailOperationInProgress || isInEmailCooldown)
                        ? `Please wait${secondsLeft > 0 ? ` (${secondsLeft}s)` : ""}`
                        : "Send Correction Mail to Admin"}
                  </Button>
                  {(emailOperationInProgress || isInEmailCooldown) && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Cooldown active. You can send again in {Math.max(0, secondsLeft)}s.
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Rate limit help: The provider allows up to 2 requests per second. We enforce spacing and will queue if needed to prevent violations.
                  </div>
                </div>

                <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">Send Custom Email</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    Send a custom email to all users with your own subject and message.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email-subject" className="text-sm font-medium">Subject</Label>
                      <Input
                        id="email-subject"
                        value={customEmailSubject}
                        onChange={(e) => setCustomEmailSubject(e.target.value)}
                        placeholder="Enter email subject..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email-message" className="text-sm font-medium">Message</Label>
                      <Textarea
                        id="email-message"
                        value={customEmailMessage}
                        onChange={(e) => setCustomEmailMessage(e.target.value)}
                        placeholder="Enter your message here..."
                        className="mt-1 min-h-[120px]"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-response-link"
                        checked={includeResponseLink}
                        onCheckedChange={setIncludeResponseLink}
                      />
                      <Label htmlFor="include-response-link" className="text-sm">
                        Include response link buttons (Yes/Maybe/No)
                      </Label>
                    </div>

                    <Button 
                      onClick={sendCustomEmail}
                      disabled={sendingCustomEmail || emailOperationInProgress || isInEmailCooldown}
                      className="btn-primary w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendingCustomEmail
                        ? "Sending..."
                        : (emailOperationInProgress || isInEmailCooldown)
                          ? `Please wait${secondsLeft > 0 ? ` (${secondsLeft}s)` : ""}`
                          : "Send Custom Email to All Users"}
                    </Button>
                    {(emailOperationInProgress || isInEmailCooldown) && (
                      <div className="text-xs text-muted-foreground mt-2">
                        You can send again in {Math.max(0, secondsLeft)}s.
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      Current rate: {currentRatePerSec}/{RATE_LIMIT_PER_SEC} req/s • Queue: {queue.length}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch Sending (auto-compliant) */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">📦 Batch Send (Auto Rate-Limited)</CardTitle>
              <CardDescription className="text-sm">
                Paste one email per line or comma-separated. We will send at 2 req/s max.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-3">
                <Textarea
                  placeholder="user1@example.com\nuser2@example.com, user3@example.com"
                  className="min-h-[120px]"
                  value={batchEmailsText}
                  onChange={(e) => setBatchEmailsText(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    className="btn-primary"
                    disabled={batchSending || queue.length > 0}
                    onClick={() => {
                      const emails = Array.from(
                        new Set(
                          batchEmailsText
                            .split(/\s|,|;|\n/g)
                            .map((s) => s.trim())
                            .filter((s) => s && /.+@.+\..+/.test(s))
                        )
                      );
                      if (emails.length === 0) {
                        toast({ title: 'No valid emails', description: 'Please paste at least one valid email.', variant: 'destructive' });
                        return;
                      }
                      setQueue(emails);
                      setBatchSending(true);
                      setBatchTotal(emails.length);
                      setBatchSent(0);
                      setLogs((prev) => [
                        `${new Date().toISOString()}: Batch started with ${emails.length} emails (auto 2 req/s)`,
                        ...prev,
                      ]);
                    }}
                  >
                    Start Batch
                  </Button>
                  <Button
                    variant="outline"
                    disabled={queue.length === 0 && !batchSending}
                    onClick={() => {
                      setQueue([]);
                      setBatchSending(false);
                      setBatchTotal(0);
                      setBatchSent(0);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {batchSending || queue.length > 0 ? (
                    <>
                      Queue: {queue.length} pending • Progress: {batchSent}/{batchTotal} • Next in ~{Math.ceil(nextSlotMs / 100) / 10}s
                    </>
                  ) : (
                    <>No batch in progress.</>
                  )}
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