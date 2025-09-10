import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { WeeklyResponse, User, ResponseStatus } from "@/lib/types";
import { getStatusColor, getStatusLabel, formatDate } from "@/lib/utils";

interface ResponseData extends WeeklyResponse {
  users: User;
}

const Respond = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [autoProcessed, setAutoProcessed] = useState(false);

  useEffect(() => {
    const fetchResponse = async () => {
      if (!token) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('weekly_responses')
          .select(`
            *,
            users (*)
          `)
          .eq('response_token', token)
          .maybeSingle();

        if (error || !data) {
          setNotFound(true);
        } else {
          // Check if we're within the response window
          // Response window: Tuesday 10:30 AM until Wednesday 8:00 PM
          const sessionDate = new Date(data.week_date + 'T17:30:00');
          const responseDeadline = new Date(data.week_date + 'T20:00:00'); // Wednesday 8 PM
          const now = new Date();
          
          if (now > responseDeadline) {
            setNotFound(true);
            console.log('Token expired - response window closed (after Wednesday 8 PM)');
          } else {
            setResponse(data as ResponseData);
          }
        }
      } catch (error) {
        console.error('Error fetching response:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchResponse();
  }, [token]);

  const handleResponse = useCallback(async (status: ResponseStatus) => {
    if (!response) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('weekly_responses')
        .update({ 
          status,
          responded_at: new Date().toISOString()
        })
        .eq('id', response.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Response recorded! ⚽",
        description: `Thanks ${response.users.name}! Your response has been saved.`,
      });

      // Update local state
      setResponse({
        ...response,
        status,
        responded_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating response:', error);
      toast({
        title: "Error",
        description: "Failed to save your response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }, [response]);

  // Auto-process response from URL parameter - only after data is fully loaded
  useEffect(() => {
    if (response && !loading && !autoProcessed) {
      const urlResponse = searchParams.get('response');
      if (urlResponse && ['yes', 'maybe', 'no'].includes(urlResponse)) {
        setAutoProcessed(true);
        // Small delay to ensure state is stable
        setTimeout(() => {
          handleResponse(urlResponse as ResponseStatus);
        }, 100);
      }
    }
  }, [response, loading, searchParams, autoProcessed, handleResponse]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound || !response) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Response Not Found</CardTitle>
            <CardDescription>
              This response link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasResponded = response.status !== 'no_response';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-4">TIKI TAKA</h1>
            <p className="text-muted-foreground">
              Weekly Training Response
            </p>
          </div>

          {/* Response Card */}
          <Card>
            <CardHeader>
              <CardTitle>Hi {response.users.name}! 👋</CardTitle>
              <CardDescription>
                Are you coming to training on {formatDate(response.week_date)} at 17:30?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Current Status */}
              {hasResponded && (
                <div className="text-center py-6 border-b border-border">
                  <p className="text-base font-medium text-foreground mb-4">Current Response:</p>
                  <Badge className={`${getStatusColor(response.status)} text-xl px-6 py-3 font-bold text-white shadow-lg`}>
                    {getStatusLabel(response.status)}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-4 font-medium">
                    You can change your response below
                  </p>
                </div>
              )}

              {/* Response Buttons */}
              <div className="flex flex-col items-center space-y-3">
                <Button
                  onClick={() => handleResponse('yes')}
                  disabled={submitting}
                  className="response-btn-yes w-80 max-w-full"
                  variant="default"
                >
                  ✅ YES - I'm playing
                </Button>

                <Button
                  onClick={() => handleResponse('maybe')}
                  disabled={submitting}
                  className="response-btn-maybe w-80 max-w-full"
                  variant="default"
                >
                  🤔 MAYBE - Not sure yet
                </Button>

                <Button
                  onClick={() => handleResponse('no')}
                  disabled={submitting}
                  className="response-btn-no w-80 max-w-full"
                  variant="default"
                >
                  ❌ NO - Can't make it
                </Button>
              </div>

              {submitting && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Saving response...</p>
                </div>
              )}

              {/* Helpful Info */}
              <div className="mt-6 p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  💡 <strong>Tip:</strong> You can always access this page by clicking the link in your weekly email, 
                  or bookmark this page to quickly update your response anytime.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer Links */}
          <div className="text-center mt-8 space-y-4">
            <Button variant="outline" asChild className="btn-secondary">
              <Link to="/whos-playing">See Who's Playing</Link>
            </Button>
            
            <div>
              <Button variant="ghost" asChild className="btn-secondary">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Respond;