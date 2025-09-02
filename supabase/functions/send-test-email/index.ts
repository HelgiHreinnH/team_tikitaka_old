import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { WeeklyInvitationEmail } from './_templates/weekly-invitation.tsx'

const resendApiKey = Deno.env.get('RESEND_API_KEY')
console.log('RESEND_API_KEY exists:', !!resendApiKey)

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY environment variable is not set')
}

const resend = new Resend(resendApiKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { email } = await req.json()
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email address is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    console.log('Attempting to send email to:', email)
    
    // Generate a test response token (in real implementation, this would come from database)
    const testToken = 'test-token-' + Date.now()
    const weekDate = 'Wednesday, September 4th, 2025'
    const baseUrl = 'https://tikitaka.designingforusers.com'
    
    // Render the email template
    const emailHtml = await renderAsync(
      React.createElement(WeeklyInvitationEmail, {
        playerName: 'Helgi',
        weekDate,
        responseToken: testToken,
        baseUrl,
      })
    )
    
    const { data, error } = await resend.emails.send({
      from: 'Tiki Taka <onboarding@resend.dev>',
      to: [email],
      subject: 'Ready for Tiki Taka this Wednesday? ⚽',
      html: emailHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    console.log(`Test email sent successfully to ${email}:`, data)

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test email sent successfully to ${email}`,
      data 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error in send-test-email function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})