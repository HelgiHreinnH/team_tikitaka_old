import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, WeeklyResponse, ResponseStatus } from "@/lib/types";
import { getStatusColor, getStatusLabel, getNextWednesday, formatWeekDate, formatDate } from "@/lib/utils";

interface UserWithResponse extends User {
  weekly_responses: WeeklyResponse[];
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

      // Fetch all users and their responses for this week (left join to show all users)
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          weekly_responses(*)
        `)
        .eq('weekly_responses.week_date', weekDate)
        .order('name');

      if (error) {
        console.error('Error fetching attendance:', error);
        return;
      }

      // Type assertion for Supabase data
      setUsers((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    // Set up real-time subscription
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
    user.weekly_responses?.[0]?.status === 'yes'
  ).length;

  const maybeCount = users.filter(user => 
    user.weekly_responses?.[0]?.status === 'maybe'
  ).length;

  const notPlayingCount = users.filter(user => 
    user.weekly_responses?.[0]?.status === 'no'
  ).length;

  const noResponseCount = users.filter(user => 
    !user.weekly_responses?.[0] || user.weekly_responses[0]?.status === 'no_response'
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
              Playing: {playingCount}
            </Badge>
            <Badge variant="secondary" className="status-maybe">
              Maybe: {maybeCount}
            </Badge>
            <Badge variant="secondary" className="status-no">
              Not Playing: {notPlayingCount}
            </Badge>
            <Badge variant="secondary" className="status-no_response">
              No Response: {noResponseCount}
            </Badge>
          </div>
        </div>

        {/* Players List */}
        <div className="max-w-2xl mx-auto space-y-3">
          {users.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No players registered yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/">Join the Team</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            users.map((user) => {
              const response = user.weekly_responses?.[0];
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
                      <h3 className="font-semibold">{user.nickname || user.name}</h3>
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
          <Button variant="outline" asChild>
            <Link to="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhosPlaying;