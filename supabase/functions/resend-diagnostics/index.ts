import { Resend } from 'npm:resend@4.0.0'

const resendApiKey = Deno.env.get('RESEND_API_KEY')

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
    console.log('Fetching Resend diagnostics...')
    
    // Get domain information
    const { data: domains, error: domainsError } = await resend.domains.list()
    
    if (domainsError) {
      console.error('Error fetching domains:', domainsError)
    }

    // Try to get emails using the correct API method
    let emails = null
    let emailsError = null
    
    try {
      // Use the correct method for getting emails
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        emails = emailData.data || []
      } else {
        emailsError = `HTTP ${emailResponse.status}: ${emailResponse.statusText}`
      }
    } catch (error) {
      console.error('Error fetching emails via API:', error)
      emailsError = error.message
    }

    // Try to get API keys
    let apiKeys = null
    let apiKeysError = null
    
    try {
      const apiKeyResponse = await fetch('https://api.resend.com/api-keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (apiKeyResponse.ok) {
        const apiKeyData = await apiKeyResponse.json()
        apiKeys = apiKeyData.data || []
      } else {
        apiKeysError = `HTTP ${apiKeyResponse.status}: ${apiKeyResponse.statusText}`
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
      apiKeysError = error.message
    }

    // Calculate email statistics
    const emailStats = {
      total: emails?.length || 0,
      sent: emails?.filter(email => email.status === 'sent').length || 0,
      delivered: emails?.filter(email => email.status === 'delivered').length || 0,
      bounced: emails?.filter(email => email.status === 'bounced').length || 0,
      complained: emails?.filter(email => email.status === 'complained').length || 0,
    }

    // Get recent emails by date
    const today = new Date().toISOString().split('T')[0]
    const todaysEmails = emails?.filter(email => 
      email.created_at && email.created_at.startsWith(today)
    ).length || 0

    const diagnostics = {
      timestamp: new Date().toISOString(),
      domains: domains || [],
      apiKeys: apiKeys?.map(key => ({
        id: key.id,
        name: key.name,
        created_at: key.created_at
      })) || [],
      emailStats,
      todaysEmails,
      recentEmails: emails?.slice(0, 10).map(email => ({
        id: email.id,
        to: email.to,
        subject: email.subject,
        status: email.status,
        created_at: email.created_at,
        last_event: email.last_event
      })) || []
    }

    console.log('Resend diagnostics retrieved successfully')

    return new Response(JSON.stringify({
      success: true,
      data: diagnostics
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error in resend-diagnostics function:', error)
    return new Response(JSON.stringify({ 
      error: `Failed to get Resend diagnostics: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})