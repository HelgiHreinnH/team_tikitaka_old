import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    console.log('Starting weekly responses reset process...')
    
    // Get current date to determine which week we're resetting
    const now = new Date()
    const currentWednesday = new Date(now)
    
    // Find the most recent Wednesday (could be past or future)
    const daysSinceWednesday = (now.getDay() + 4) % 7  // Days since last Wednesday
    currentWednesday.setDate(now.getDate() - daysSinceWednesday)
    
    const weekDateForDB = currentWednesday.toISOString().split('T')[0]
    
    console.log(`Resetting responses for week: ${weekDateForDB}`)
    
    // Reset all responses for the current week back to 'no_response'
    const { data: resetData, error: resetError } = await supabase
      .from('weekly_responses')
      .update({ 
        status: 'no_response',
        responded_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('week_date', weekDateForDB)
      .select('id, user_id')
    
    if (resetError) {
      throw new Error(`Failed to reset weekly responses: ${resetError.message}`)
    }
    
    const resetCount = resetData?.length || 0
    console.log(`Reset ${resetCount} weekly responses to 'no_response'`)
    
    // Also get user information for logging
    let userDetails = []
    if (resetCount > 0) {
      const userIds = resetData.map(r => r.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, nickname')
        .in('id', userIds)
      
      userDetails = users || []
    }
    
    console.log('Weekly responses reset completed successfully')
    
    return new Response(JSON.stringify({
      success: true,
      message: `Weekly responses reset completed: ${resetCount} responses reset to 'no_response'`,
      weekDate: weekDateForDB,
      resetCount,
      resetUsers: userDetails.map(u => ({
        email: u.email,
        name: u.nickname || u.name
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
    
  } catch (error) {
    console.error('Error in reset-weekly-responses function:', error)
    return new Response(JSON.stringify({ 
      error: `Failed to reset weekly responses: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})