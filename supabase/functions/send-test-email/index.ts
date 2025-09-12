/* global Deno */
// @ts-ignore - Deno npm specifier in edge function
import { Resend } from 'npm:resend@4.0.0'
// @ts-ignore - Deno npm specifier in edge function
import { renderAsync } from 'npm:@react-email/components@0.0.22'
// @ts-ignore - Deno npm specifier in edge function
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

// --- Rate limit & queue handling ---
type ResendErrorLike = {
  status?: number
  statusCode?: number
  name?: string
  message?: string
  response?: { headers?: { get?: (key: string) => string | null | undefined } }
  retryAfter?: number | string
}

type SendJob = {
  email: string
  playerName: string
  weekDate: string
  responseToken: string
  baseUrl: string
}

// Simple in-memory queue and single-flight processor to avoid bursts
const jobQueue: SendJob[] = []
let isProcessing = false

const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

function getExponentialBackoffMs(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * Math.pow(2, attempt))
  const jitter = Math.floor(Math.random() * 250)
  return base + jitter
}

function isRateLimitError(err: unknown): boolean {
  const e = err as ResendErrorLike
  const nameStr = typeof e?.name === 'string' ? e.name.toLowerCase() : ''
  const msgStr = typeof e?.message === 'string' ? e.message.toLowerCase() : ''
  return (
    e?.status === 429 ||
    e?.statusCode === 429 ||
    nameStr.includes('rate') ||
    msgStr.includes('too many requests') ||
    msgStr.includes('rate limit')
  )
}

function parseRetryAfterMs(err: unknown): number | undefined {
  const e = err as ResendErrorLike
  const retryAfterHeader = e?.response?.headers?.get?.('retry-after') || e?.retryAfter
  if (retryAfterHeader) {
    const asNumber = Number(retryAfterHeader)
    if (!Number.isNaN(asNumber)) {
      // retry-after seconds
      return asNumber * 1000
    }
  }
  return undefined
}

async function sendEmailWithRetry(job: SendJob): Promise<{ data: unknown }>
{
  let attempt = 0
  // Render the email HTML once per job
  const emailHtml = await renderAsync(
    React.createElement(WeeklyInvitationEmail, {
      playerName: job.playerName,
      weekDate: job.weekDate,
      responseToken: job.responseToken,
      baseUrl: job.baseUrl,
    })
  )

  // Try-send loop
  while (true) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Tiki Taka <onboarding@resend.dev>',
        to: [job.email],
        subject: 'Ready for Tiki Taka this Wednesday? ⚽',
        html: emailHtml,
      })

      if (error) {
        if (isRateLimitError(error)) {
          attempt += 1
          const retryAfterMs = parseRetryAfterMs(error) ?? getExponentialBackoffMs(attempt)
          console.warn(
            `Resend rate limit encountered. Attempt ${attempt}/${MAX_RETRIES}. Waiting ${retryAfterMs}ms.`,
            {
              email: job.email,
              queueSize: jobQueue.length,
              errorMessage: error?.message,
            }
          )

          if (attempt >= MAX_RETRIES) {
            throw Object.assign(new Error('Rate limit: retries exhausted'), { status: 429 })
          }
          await new Promise((r) => setTimeout(r, retryAfterMs))
          continue
        }

        // Non-rate-limit error
        throw error
      }

      return { data }
    } catch (err) {
      if (isRateLimitError(err)) {
        attempt += 1
        const retryAfterMs = parseRetryAfterMs(err) ?? getExponentialBackoffMs(attempt)
        console.warn(
          `Resend rate limit exception. Attempt ${attempt}/${MAX_RETRIES}. Waiting ${retryAfterMs}ms.`,
          {
            email: job.email,
            queueSize: jobQueue.length,
            errorMessage: (err as Error)?.message || (err as ResendErrorLike)?.message,
          }
        )
        if (attempt >= MAX_RETRIES) {
          throw Object.assign(new Error('Rate limit: retries exhausted'), { status: 429 })
        }
        await new Promise((r) => setTimeout(r, retryAfterMs))
        continue
      }
      // Unexpected error
      throw err
    }
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!
      try {
        console.log('Processing queued email job', { email: job.email, remaining: jobQueue.length })
        await sendEmailWithRetry(job)
        console.log('Queued test email sent successfully', { email: job.email })
      } catch (err) {
        if (isRateLimitError(err)) {
          console.warn('Queued job failed due to rate limit after retries', { email: job.email })
        } else {
          console.error('Queued job failed', { email: job.email, error: (err as Error)?.message ?? String(err) })
        }
        // Continue to next job; errors are logged for monitoring
      }
    }
  } finally {
    isProcessing = false
  }
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

    const job: SendJob = {
      email,
      playerName: 'Helgi',
      weekDate,
      responseToken: testToken,
      baseUrl,
    }

    // If something is already processing, queue and return 202 to avoid burst sending
    if (isProcessing || jobQueue.length > 0) {
      jobQueue.push(job)
      console.warn('Request queued to avoid rate limiting', { email, position: jobQueue.length })
      // Kick processing in background if not already
      void processQueue()
      return new Response(
        JSON.stringify({
          queued: true,
          position: jobQueue.length,
          message: 'We are sending test emails as fast as allowed. Your request is queued and will be sent shortly.',
        }),
        { status: 202, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Otherwise process immediately and return result
    try {
      const { data } = await sendEmailWithRetry(job)
      console.log(`Test email sent successfully to ${email}:`, data)
      // After successful immediate send, also process any queued items in background
      if (jobQueue.length > 0) {
        void processQueue()
      }
      return new Response(
        JSON.stringify({ success: true, message: `Test email sent successfully to ${email}`, data }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn('Rate limit reached even after retries during immediate send', { email })
        return new Response(
          JSON.stringify({
            error: 'Rate limited',
            message:
              'Too many requests to the email provider right now. Please wait a minute and try again. We back off automatically to respect limits.',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
      console.error('Error in send-test-email function (immediate send):', err)
      return new Response(JSON.stringify({ error: (err as Error)?.message || 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

  } catch (error) {
    console.error('Error in send-test-email function:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})