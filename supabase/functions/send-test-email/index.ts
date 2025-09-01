import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

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

    const { data, error } = await resend.emails.send({
      from: 'Tiki Taka <auth@yourdomain.com>',
      to: [email],
      subject: 'Test Email from Tiki Taka ⚽',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Tiki Taka Test Email ⚽</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            This is a test email from your Tiki Taka application!
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            If you're seeing this, your email configuration is working correctly.
          </p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-weight: bold;">Test Details:</p>
            <p style="margin: 5px 0 0 0; color: #666;">Sent to: ${email}</p>
            <p style="margin: 5px 0 0 0; color: #666;">Timestamp: ${new Date().toISOString()}</p>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
            Sent from Tiki Taka Football App
          </p>
        </div>
      `,
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