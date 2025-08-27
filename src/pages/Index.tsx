import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getNextWednesday, formatWeekDate } from "@/lib/utils";

const Index = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in your name and email",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ name: name.trim(), email: email.trim(), phone: phone.trim() || null }])
        .select()
        .single();

      if (userError) {
        if (userError.code === '23505') { // Unique constraint violation
          toast({
            title: "Already registered",
            description: "This email is already registered for the team",
            variant: "destructive"
          });
        } else {
          throw userError;
        }
        return;
      }

      // Create weekly response for next Wednesday
      const nextWednesday = getNextWednesday();
      const { error: responseError } = await supabase
        .from('weekly_responses')
        .insert([{
          user_id: userData.id,
          week_date: formatWeekDate(nextWednesday),
          status: 'no_response'
        }]);

      if (responseError) {
        console.error('Response creation error:', responseError);
      }

      toast({
        title: "Welcome to Tiki Taka! ⚽",
        description: "You're now registered. Check your email for weekly invites.",
      });

      // Reset form
      setName("");
      setEmail("");
      setPhone("");

    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Registration failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black mb-6 tracking-tight">
            TIKI TAKA FOOTBALL TEAM
          </h1>
        </div>

        {/* Registration Form */}
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Join the Team</CardTitle>
              <CardDescription>
                Register to receive weekly training invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Registering..." : "Join Tiki Taka"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="text-center mt-16 space-y-4">
          <p className="text-sm text-muted-foreground">Quick Links</p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <a href="/whos-playing">Who's Playing?</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
