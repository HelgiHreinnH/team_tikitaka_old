import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponseStatus } from "@/lib/types";
import { getStatusColor, getStatusLabel, getNextWednesday, formatWeekDate, formatDate } from "@/lib/utils";

interface PublicUser {
  id: string;
  name: string;
  nickname?: string;
  created_at: string;
}

interface PublicResponse {
  id: string;
  user_id: string;
  week_date: string;
  status: ResponseStatus;
  responded_at?: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_nickname?: string;
}

interface UserWithResponse extends PublicUser {
  weekly_responses_public: PublicResponse[];
}

const WhosPlaying = () => {
  const [users, setUsers] = useState<UserWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<string>("");

  const fetchAttendance = async () => {
    try {
      const nextWednesday = getNextWednesday();
      const weekDate = formatWeekDate(nextWednesday);
      setCurrentWeek(weekDate);

      // Get total registered users count
      const { count: totalUsers } = await supabase
        .from('users_public')
        .select('*', { count: 'exact', head: true });

      // Fetch responses for this week with user data from secure public view
      const { data: responses, error } = await supabase
        .from('weekly_responses_public')
        .select('*')
        .eq('week_date', weekDate)
        .order('user_name');

      if (error) {
        console.error('Error fetching attendance:', error);
        return;
      }

      // Create user objects - only show identity for those who responded
      const respondedUsers: UserWithResponse[] = [];
      const responseCount = responses?.length || 0;
      const totalCount = totalUsers || 0;

      // Add responded users with their identities
      responses?.forEach(response => {
        if (response.status !== 'no_response') {
          respondedUsers.push({
            id: response.user_id,
            name: response.user_name,
            nickname: response.user_nickname,
            created_at: response.created_at,
            weekly_responses_public: [{
              ...response,
              status: response.status as ResponseStatus
            }]
          });
        }
      });

      // Add anonymous entries for non-responders
      const nonResponderCount = totalCount - responseCount;
      for (let i = 0; i < nonResponderCount; i++) {
        respondedUsers.push({
          id: `anonymous-${i}`,
          name: `Player ${i + 1}`,
          nickname: undefined,
          created_at: '',
          weekly_responses_public: [{
            id: `no-response-${i}`,
            user_id: `anonymous-${i}`,
            week_date: weekDate,
            status: 'no_response',
            created_at: '',
            updated_at: '',
            user_name: `Player ${i + 1}`,
            user_nickname: undefined
          }]
        });
      }

      setUsers(respondedUsers);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

        // Set up real-time subscription for weekly responses changes
        const channel = supabase
          .channel('weekly-responses-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'weekly_responses'
            },
            () => {
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

  const respondedCount = users.filter(user => 
    user.weekly_responses_public?.[0]?.status !== 'no_response' && 
    !user.id.startsWith('anonymous-')
  ).length;

  const totalRegistered = users.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2">WHO's PLAYING?</h1>
          <p className="text-muted-foreground mb-4">
            {formatDate(currentWeek)} at 17:30
          </p>
          
          {/* Stats Summary */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-2">
              👥 <strong>{totalRegistered}</strong> total registered players
            </p>
            <p className="text-sm text-muted-foreground">
              📝 <strong>{respondedCount}</strong> have responded • <strong>{noResponseCount}</strong> pending
            </p>
          </div>

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
              const isAnonymous = user.id.startsWith('anonymous-');
              
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
                <Card key={user.id} className={`${getBorderColor(status)} transition-colors ${isAnonymous ? 'opacity-60' : ''}`}>
                  <CardContent className="flex justify-between items-center py-4">
                    <div>
                      <h3 className="font-semibold">
                        {isAnonymous ? (
                          <span className="text-muted-foreground">
                            🕶️ {user.name} (Not responded)
                          </span>
                        ) : (
                          // Show nickname if available, otherwise show name
                          response?.user_nickname || user.nickname || user.name
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isAnonymous ? (
                          'Awaiting response...'
                        ) : response?.responded_at ? (
                          `Responded ${new Date(response.responded_at).toLocaleDateString()}`
                        ) : (
                          'Response pending'
                        )}
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