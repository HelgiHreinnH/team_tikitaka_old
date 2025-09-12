import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { WeeklyInvitationEmail } from './_templates/weekly-invitation.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  const startTime = new Date().toISOString()
  console.log(`[${startTime}] Weekly invites function triggered`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Environment and client initialization inside handler for better error reporting
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const hasResendKey = !!resendApiKey
    const hasSupabaseUrl = !!supabaseUrl
    const hasServiceKey = !!supabaseServiceKey
    console.log(`Environment check: Resend=${hasResendKey}, Supabase=${hasSupabaseUrl}, Service=${hasServiceKey}`)

    if (!hasResendKey || !hasSupabaseUrl || !hasServiceKey) {
      throw new Error('Missing required environment variables')
    }

    const resend = new Resend(resendApiKey as string)
    const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string)

    console.log('Starting weekly invite send process...')
    
    // Get next Wednesday's date - using standardized formula
    const now = new Date()
    const nextWednesday = new Date(now)
    
    // Standardized formula: find next Wednesday (day 3)
    // If today is Wednesday, get next week's Wednesday
    const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7
    nextWednesday.setDate(now.getDate() + daysUntilWednesday)
    
    // Format the date string
    const weekDate = nextWednesday.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    const weekDateForDB = nextWednesday.toISOString().split('T')[0]
    
    console.log(`Sending invites for ${weekDate} (${weekDateForDB})`)
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, nickname')
    
    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }
    
    if (!users || users.length === 0) {
      console.log('No users found to send invites to')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No users found to send invites to' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    
    console.log(`Found ${users.length} users to send invites to`)
    
    const results = []
    const baseUrl = 'https://tikitaka.designingforusers.com'
    
    // Process each user
    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email}`)
        
        // Check if weekly response already exists for this user and week
        const { data: existingResponse, error: checkError } = await supabase
          .from('weekly_responses')
          .select('id, response_token')
          .eq('user_id', user.id)
          .eq('week_date', weekDateForDB)
          .maybeSingle()
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw new Error(`Error checking existing response for ${user.email}: ${checkError.message}`)
        }
        
        let responseToken
        
        if (existingResponse) {
          // Use existing token
          responseToken = existingResponse.response_token
          console.log(`Using existing response token for ${user.email}`)
        } else {
          // Create new weekly response record with proper error handling
          const { data: newResponse, error: responseError } = await supabase
            .from('weekly_responses')
            .insert({
              user_id: user.id,
              week_date: weekDateForDB,
              status: 'no_response'
            })
            .select('response_token')
            .maybeSingle()
          
          if (responseError) {
            // Handle duplicate key error gracefully (race condition)
            if (responseError.code === '23505') {
              console.log(`Response already exists for ${user.email}, retrying...`)
              // Retry getting the existing token
              const { data: retryResponse } = await supabase
                .from('weekly_responses')
                .select('response_token')
                .eq('user_id', user.id)
                .eq('week_date', weekDateForDB)
                .maybeSingle()
              
              if (retryResponse) {
                responseToken = retryResponse.response_token
              } else {
                throw new Error(`Failed to get response token for ${user.email} after retry`)
              }
            } else {
              throw new Error(`Failed to create response for ${user.email}: ${responseError.message}`)
            }
          } else if (!newResponse) {
            throw new Error(`Failed to create response for ${user.email}: No response returned`)
          } else {
            responseToken = newResponse.response_token
            console.log(`Created new response token for ${user.email}`)
          }
        }
        
        // Use nickname if available, otherwise use name
        const displayName = user.nickname || user.name
        
        // Render the email template
        const emailHtml = await renderAsync(
          React.createElement(WeeklyInvitationEmail, {
            playerName: displayName,
            weekDate,
            responseToken,
            baseUrl,
          })
        )
        
        // Send email
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Tiki Taka <onboarding@resend.dev>',
          to: [user.email],
          subject: `Ready for Tiki Taka this Wednesday? ⚽`,
          html: emailHtml,
        })
        
        if (emailError) {
          throw new Error(`Failed to send email to ${user.email}: ${emailError.message}`)
        }
        
        results.push({
          email: user.email,
          name: displayName,
          status: 'sent',
          emailId: emailData?.id
        })
        
        console.log(`Successfully sent email to ${user.email}`)
        
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError)
        results.push({
          email: user.email,
          name: user.nickname || user.name,
          status: 'failed',
          error: (userError as Error).message
        })
      }
    }
    
    const successCount = results.filter(r => r.status === 'sent').length
    const failedCount = results.filter(r => r.status === 'failed').length
    
    console.log(`Weekly invite send completed: ${successCount} sent, ${failedCount} failed`)
    
    return new Response(JSON.stringify({
      success: true,
      message: `Weekly invites sent: ${successCount} successful, ${failedCount} failed`,
      weekDate,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
    
  } catch (error) {
    console.error(`[${startTime}] Function failed:`, error)
    return new Response(JSON.stringify({ 
      error: `Failed to send weekly invites: ${(error as Error).message}`,
      timestamp: startTime 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})