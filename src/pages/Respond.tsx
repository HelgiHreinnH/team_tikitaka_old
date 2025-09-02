import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setResponse(data as ResponseData);
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

  // Auto-process response from URL parameter
  useEffect(() => {
    if (response && !autoProcessed) {
      const urlResponse = searchParams.get('response');
      if (urlResponse && ['yes', 'maybe', 'no'].includes(urlResponse)) {
        setAutoProcessed(true);
        handleResponse(urlResponse as ResponseStatus);
      }
    }
  }, [response, searchParams, autoProcessed, handleResponse]);

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
              <a href="/">Go to Home</a>
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
            <CardContent className="space-y-6">
              {/* Current Status */}
              {hasResponded && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Current Response:</p>
                  <Badge className={getStatusColor(response.status)}>
                    {getStatusLabel(response.status)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can still change your response below
                  </p>
                </div>
              )}

              {/* Response Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => handleResponse('yes')}
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  variant={response.status === 'yes' ? 'default' : 'outline'}
                >
                  ✅ YES - I'm playing
                </Button>

                <Button
                  onClick={() => handleResponse('maybe')}
                  disabled={submitting}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  variant={response.status === 'maybe' ? 'default' : 'outline'}
                >
                  🤔 MAYBE - Not sure yet
                </Button>

                <Button
                  onClick={() => handleResponse('no')}
                  disabled={submitting}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  variant={response.status === 'no' ? 'default' : 'outline'}
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
            </CardContent>
          </Card>

          {/* Footer Links */}
          <div className="text-center mt-8 space-y-4">
            <Button variant="outline" asChild>
              <a href="/whos-playing">See Who's Playing</a>
            </Button>
            
            <div>
              <Button variant="ghost" asChild>
                <a href="/" className="text-sm">Back to Home</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Respond;