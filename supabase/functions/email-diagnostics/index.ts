import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting email diagnostics...')
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        RESEND_API_KEY_EXISTS: !!Deno.env.get('RESEND_API_KEY'),
        RESEND_API_KEY_LENGTH: Deno.env.get('RESEND_API_KEY')?.length || 0,
        SUPABASE_URL_EXISTS: !!Deno.env.get('SUPABASE_URL'),
        SUPABASE_SERVICE_KEY_EXISTS: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      },
      tests: {}
    } as any

    // Test 1: Check if we can create Resend instance
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not found')
      }
      
      const resend = new Resend(resendApiKey)
      diagnostics.tests.resend_instance = { success: true, message: 'Resend instance created successfully' }
      
      // Test 2: Try to send a simple test email
      try {
        const result = await resend.emails.send({
          from: 'Tiki Taka Diagnostics <onboarding@resend.dev>',
          to: ['helgihreinn@me.com'],
          subject: 'Email Diagnostics Test',
          html: '<h1>Test Email</h1><p>This is a diagnostic test email to verify the Resend integration is working.</p>',
        })

        if (result.error) {
          diagnostics.tests.send_email = { 
            success: false, 
            error: result.error,
            message: 'Email send failed with Resend error'
          }
        } else {
          diagnostics.tests.send_email = { 
            success: true, 
            data: result.data,
            message: 'Email sent successfully'
          }
        }
      } catch (emailError) {
        diagnostics.tests.send_email = { 
          success: false, 
          error: String(emailError),
          message: 'Email send threw exception'
        }
      }
      
    } catch (resendError) {
      diagnostics.tests.resend_instance = { 
        success: false, 
        error: String(resendError),
        message: 'Failed to create Resend instance'
      }
    }

    console.log('Diagnostics completed:', diagnostics)

    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Diagnostics function error:', error)
    return new Response(JSON.stringify({ 
      error: String(error),
      message: 'Diagnostics function failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})