import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { CustomEmail } from "./_templates/custom-email.tsx";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }

  try {
    const { subject, message, includeResponseLink } = await req.json();

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Subject and message are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    const baseUrl = "https://tikitaka.designingforusers.com";
    
    // Calculate next Wednesday if we need response links
    let weekDate = '';
    let formattedDate = '';
    
    if (includeResponseLink) {
      const today = new Date();
      const nextWednesday = new Date(today);
      const daysUntilWednesday = (3 - today.getDay() + 7) % 7;
      if (daysUntilWednesday === 0 && today.getDay() === 3) {
        nextWednesday.setDate(today.getDate() + 7);
      } else {
        nextWednesday.setDate(today.getDate() + daysUntilWednesday);
      }
      
      weekDate = nextWednesday.toISOString().split('T')[0];
      formattedDate = nextWednesday.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    console.log(`Processing custom emails with subject: ${subject}`);

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      throw new Error(`Error fetching users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users found' }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    console.log(`Found ${users.length} users to email`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        let responseToken = '';

        if (includeResponseLink) {
          // Get or create weekly response for this user and week
          let existingResponse = await supabase
            .from('weekly_responses')
            .select('response_token')
            .eq('user_id', user.id)
            .eq('week_date', weekDate)
            .maybeSingle();

          if (existingResponse.data) {
            responseToken = existingResponse.data.response_token;
          } else {
            // Create new weekly response
            const { data: newResponse, error: insertError } = await supabase
              .from('weekly_responses')
              .insert({
                user_id: user.id,
                week_date: weekDate,
                status: 'no_response'
              })
              .select('response_token')
              .single();

            if (insertError) {
              console.error(`Error creating weekly response for ${user.email}:`, insertError);
              continue;
            }
            responseToken = newResponse.response_token;
          }
        }

        // Render the email template
        const emailHtml = await renderAsync(
          React.createElement(CustomEmail, {
            playerName: user.name,
            message: message,
            includeResponseLink: includeResponseLink,
            weekDate: formattedDate,
            responseToken: responseToken,
            baseUrl: baseUrl,
          })
        );

        // Send the email
        const emailResult = await resend.emails.send({
          from: "Tiki Taka <noreply@designingforusers.com>",
          to: [user.email],
          subject: subject,
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error(`Failed to send email to ${user.email}:`, emailResult.error);
          errorCount++;
        } else {
          console.log(`✅ Custom email sent successfully to ${user.email}`);
          successCount++;
          
          // Add delay to respect Resend rate limit (2 requests per second)
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError);
        errorCount++;
      }
    }

    const summary = {
      message: `Custom email process completed`,
      totalUsers: users.length,
      emailsSent: successCount,
      errors: errorCount,
      subject: subject,
      includeResponseLink: includeResponseLink,
    };

    console.log('Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Error in send-custom-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send custom emails'
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});