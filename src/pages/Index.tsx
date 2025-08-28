import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getNextWednesday, formatWeekDate, generateCalendarEvent } from "@/lib/utils";

const Index = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
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
      // Insert user with nickname fallback logic
      const displayNickname = nickname.trim() || name.trim();
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ 
          name: name.trim(), 
          email: email.trim(), 
          phone: phone.trim() || null,
          nickname: displayNickname
        }])
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
      setNickname("");

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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black mb-4 tracking-tight">
            TIKI TAKA<br />
            FOOTBALL TEAM
          </h1>
        </div>

        {/* Main Content Section */}
        <div className="max-w-4xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Registration Form - Full width on mobile, 2/3 on desktop */}
            <div className="w-full lg:w-2/3">
              <div className="max-w-md mx-auto lg:mx-0">
                <Card>
                  <CardHeader>
                    <CardTitle>⚽ Ready to play with us?</CardTitle>
                    <CardDescription>
                      Register to receive weekly training invitations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <TooltipProvider>
                        <div>
                          <Label htmlFor="name">Full Name *</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                                required
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Your real name for our team records 📝</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div>
                          <Label htmlFor="nickname">Nickname (Optional)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                id="nickname"
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="What name do you want to show when attending"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">What we'll call you on the pitch! 🏃‍♂️</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">We'll send your weekly invites here 📧</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone (Optional)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter your phone number"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Just in case we need to reach you quickly 📱</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                type="submit" 
                                className="w-auto"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Registering..." : "Join Tiki Taka"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="text-center p-2">
                                <p className="font-semibold text-sm mb-1">🎉 Ready to join the fun?</p>
                                <p className="text-xs text-muted-foreground">
                                  You'll get weekly email invites for our Wednesday training sessions. 
                                  Just click "yes" or "no" to let us know if you're coming! 
                                  Simple as that! ⚽
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* When & Where Section - Full width on mobile, 1/3 on desktop */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 lg:gap-0">
              {/* When Section - 1/4 height on desktop */}
              <div className="lg:h-1/4 flex flex-col justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">⏰ When</h2>
                  <p className="text-lg text-muted-foreground mb-2">
                    Every Wednesday at <span className="font-semibold">17:30</span>
                  </p>
                  <Button 
                    onClick={generateCalendarEvent}
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-2"
                  >
                    📅 Add to Calendar
                  </Button>
                </div>
              </div>

              {/* Where Section - 3/4 height on desktop */}
              <div className="lg:h-3/4 flex flex-col mt-6 lg:mt-8">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold mb-2">📍 Where</h2>
                </div>
                <div className="flex-1 flex justify-center">
                <div 
                  className="w-full h-full min-h-[250px] lg:min-h-0 cursor-pointer rounded-lg overflow-hidden shadow-lg"
                  onClick={() => window.open('https://maps.google.com/?q=Kunststofbanen,+Arsenalvej,+Arsenalvej+2,+1436+København', '_blank')}
                >
                    <iframe 
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d292.4767945840716!2d12.6027670635004!3d55.67695706315111!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x465253531e198fb7%3A0x2c29b04b36ce797a!2sKunststofbanen%2C%20Arsenalvej!5e0!3m2!1sen!2sdk!4v1756320819653!5m2!1sen!2sdk" 
                      width="100%" 
                      height="100%"
                      style={{border: 0, pointerEvents: 'none'}} 
                      allowFullScreen={true}
                      loading="lazy" 
                      referrerPolicy="no-referrer-when-downgrade"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="text-center mt-8 space-y-4">
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <a href="https://tikitaka.desiningforusers.com/whos-playing">See who's joining next session</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
