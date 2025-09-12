import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { WeeklyInvitationEmail } from './_templates/weekly-invitation.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting and retry configuration (aligns with send-correction-email)
const BASE_DELAY_MS = 600 // safely under 2 req/sec
const MAX_RETRIES = 5
const BATCH_SIZE = 10
const BATCH_PAUSE_MS = 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getJitter(maxJitterMs = 250) {
  return Math.floor(Math.random() * maxJitterMs)
}

function isRateLimitError(err: unknown): boolean {
  try {
    if (!err || typeof err !== 'object') return false
    const e = err as {
      statusCode?: number
      code?: number
      name?: string
      message?: string
      error?: { statusCode?: number; name?: string; message?: string }
    }
    if (e.statusCode === 429 || e.code === 429) return true
    if (typeof e.name === 'string' && e.name.toLowerCase().includes('rate')) return true
    if (typeof e.message === 'string' && e.message.toLowerCase().includes('rate')) return true
    if (e.error) {
      if (e.error.statusCode === 429) return true
      if (typeof e.error.name === 'string' && e.error.name.toLowerCase().includes('rate')) return true
      if (typeof e.error.message === 'string' && e.error.message.toLowerCase().includes('rate')) return true
    }
    return false
  } catch (_) {
    return false
  }
}

type ResendError = { statusCode?: number; name?: string; message?: string }
type ResendSendResponse = { data?: { id: string }; error?: ResendError }

async function sendEmailWithRetry(resend: Resend, params: { to: string; subject: string; html: string; from: string; logContext: string }): Promise<ResendSendResponse> {
  let attempt = 0
  while (true) {
    try {
      const result: ResendSendResponse = await resend.emails.send({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      })

      if (result?.error) {
        const errObj = result.error
        if (isRateLimitError(errObj)) {
          throw Object.assign(new Error('Rate limit error'), { cause: errObj })
        }
        throw Object.assign(new Error('Send email failed'), { cause: errObj })
      }

      return result
    } catch (err) {
      const rateLimited = isRateLimitError(err)

      if (rateLimited && attempt < MAX_RETRIES) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt) + getJitter()
        console.warn(`[RateLimit] Attempt ${attempt + 1}/${MAX_RETRIES} for ${params.logContext}. Backing off ${backoff}ms`, { err })
        await sleep(backoff)
        attempt++
        continue
      }

      if (rateLimited) {
        console.error(`[RateLimit] Exhausted retries for ${params.logContext}`, { err })
      }

      throw err
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
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
    
    type User = { id: string; name: string | null; email: string; nickname?: string | null }
    const results: Array<{ email: string; name: string | null | undefined; status: 'sent' | 'failed'; emailId?: string; error?: string }> = []
    const baseUrl = 'https://tikitaka.designingforusers.com'
    
    // Process users in batches to avoid overwhelming the provider
    const usersTyped: User[] = (users ?? []) as unknown as User[]
    const batches = chunkArray(usersTyped, BATCH_SIZE)
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]
      console.log(`Processing batch ${b + 1}/${batches.length} (size: ${batch.length})`)

      for (const user of batch) {
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
            responseToken = existingResponse.response_token
            console.log(`Using existing response token for ${user.email}`)
          } else {
            const { data: newResponse, error: responseError } = await supabase
              .from('weekly_responses')
              .insert({
                user_id: user.id,
                week_date: weekDateForDB,
                status: 'no_response',
              })
              .select('response_token')
              .maybeSingle()

            if (responseError) {
              if (responseError.code === '23505') {
                console.log(`Response already exists for ${user.email}, retrying...`)
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

          const displayName = user.nickname || user.name
          const emailHtml = await renderAsync(
            React.createElement(WeeklyInvitationEmail, {
              playerName: displayName,
              weekDate,
              responseToken,
              baseUrl,
            })
          )

          // Send with retry/backoff on rate-limit errors
          const sendResult = await sendEmailWithRetry(resend, {
            from: 'Tiki Taka <onboarding@resend.dev>',
            to: user.email,
            subject: `Ready for Tiki Taka this Wednesday? ⚽`,
            html: emailHtml,
            logContext: `weekly-invite to ${user.email}`,
          })

          results.push({
            email: user.email,
            name: displayName,
            status: 'sent',
            emailId: sendResult.data?.id,
          })

          console.log(`✅ Successfully sent email to ${user.email}`)

          // Base inter-send delay
          await sleep(BASE_DELAY_MS)
        } catch (userError) {
          const rateLimited = isRateLimitError(userError)
          if (rateLimited) {
            console.error(`[RateLimit] Final failure for ${user.email} after retries`, { error: userError })
          } else {
            console.error(`Error processing user ${user.email}:`, userError)
          }
          results.push({
            email: user.email,
            name: user.nickname || user.name,
            status: 'failed',
            error: (userError as Error).message,
          })
        }
      }

      if (b < batches.length - 1) {
        console.log(`Pausing ${BATCH_PAUSE_MS}ms before next batch to relieve pressure`)
        await sleep(BATCH_PAUSE_MS)
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