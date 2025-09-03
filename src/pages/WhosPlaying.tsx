import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserWithPublicResponse, ResponseStatus } from "@/lib/types";
import { getStatusColor, getStatusLabel, getNextWednesday, formatWeekDate, formatDate } from "@/lib/utils";

const WhosPlaying = () => {
  const [users, setUsers] = useState<UserWithPublicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<string>("");

  const fetchAttendance = async () => {
    try {
      setError(null);
      const nextWednesday = getNextWednesday();
      const weekDate = formatWeekDate(nextWednesday);
      setCurrentWeek(weekDate);

      // Fetch users and their weekly responses with explicit join
      const { data: usersData, error } = await supabase
        .from('users_public')
        .select(`
          id,
          nickname,
          created_at
        `)
        .order('nickname');
      
      if (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load attendance data. Please try refreshing the page.');
        return;
      }

      // Fetch all weekly responses for the current week
      const { data: responsesData, error: responsesError } = await supabase
        .from('weekly_responses_public')
        .select('*')
        .eq('week_date', weekDate);

      if (responsesError) {
        console.error('Error fetching responses:', responsesError);
        setError('Failed to load attendance data. Please try refreshing the page.');
        return;
      }
      
      // Combine users with their responses
      const filteredData = usersData?.map(user => {
        const userResponse = responsesData?.find(response => response.user_id === user.id);
        
        return {
          ...user,
          weekly_responses_public: userResponse ? [{
            ...userResponse,
            status: (userResponse.status as ResponseStatus) || 'no_response'
          }] : []
        };
      }) || [];

      setUsers(filteredData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError('Something went wrong. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    // Set up real-time subscription filtered by current week
    // Recalculate the week date to handle day transitions
    const getCurrentWeekFilter = () => formatWeekDate(getNextWednesday());
    
    const channel = supabase
      .channel('weekly-responses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_responses',
          filter: `week_date=eq.${getCurrentWeekFilter()}`
        },
        () => {
          console.log('Real-time update received, refreshing attendance...');
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
          <p>Loading attendance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Unable to load attendance</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
          <div className="mt-4">
            <Button asChild variant="ghost">
              <Link to="/">← Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const playingCount = users.filter(user => 
    user.weekly_responses_public?.[0]?.status === 'yes'
  ).length;

  const maybeCount = users.filter(user => 
    user.weekly_responses_public?.[0]?.status === 'maybe'
  ).length;

  const notPlayingCount = users.filter(user => 
    user.weekly_responses_public?.[0]?.status === 'no'
  ).length;

  const noResponseCount = users.filter(user => 
    !user.weekly_responses_public?.[0] || user.weekly_responses_public[0]?.status === 'no_response'
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2">WHO's PLAYING?</h1>
          <p className="text-muted-foreground mb-4">
            {formatDate(currentWeek)} at 17:30
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Badge variant="secondary" className="status-yes">
              ✅ Playing: {playingCount}
            </Badge>
            <Badge variant="secondary" className="status-maybe">
              🤔 Maybe: {maybeCount}
            </Badge>
            <Badge variant="secondary" className="status-no">
              ❌ Not Playing: {notPlayingCount}
            </Badge>
            <Badge variant="secondary" className="status-no_response">
              ⚪ No Response: {noResponseCount}
            </Badge>
          </div>
        </div>

        {/* Players List */}
        <div className="max-w-2xl mx-auto space-y-3">
          {users.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No players registered yet.</p>
                <Button asChild className="btn-secondary mt-4">
                  <Link to="/">Join the Team</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            users.map((user) => {
              const response = user.weekly_responses_public?.[0];
              const status = (response?.status as ResponseStatus) || 'no_response';
              
              // Get border color class based on status
              const getBorderColor = (status: ResponseStatus): string => {
                switch (status) {
                  case 'yes':
                    return 'border-l-4 border-l-green-600';
                  case 'maybe':
                    return 'border-l-4 border-l-yellow-500';
                  case 'no':
                    return 'border-l-4 border-l-red-600';
                  case 'no_response':
                  default:
                    return 'border-l-4 border-l-muted';
                }
              };
              
              return (
                <Card key={user.id} className={`${getBorderColor(status)} transition-colors`}>
                  <CardContent className="flex justify-between items-center py-4">
                    <div>
                      <h3 className="font-semibold">{user.nickname || 'Anonymous Player'}</h3>
                      <p className="text-xs text-muted-foreground">
                        {response?.responded_at 
                          ? `Responded ${new Date(response.responded_at).toLocaleDateString()}`
                          : 'No response yet'
                        }
                      </p>
                    </div>
                    <Badge className={getStatusColor(status)}>
                      {getStatusLabel(status)}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Back to Home */}
        <div className="text-center mt-16">
          <Button variant="outline" asChild className="btn-secondary">
            <Link to="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhosPlaying;