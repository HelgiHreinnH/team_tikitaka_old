import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { CorrectionEmail } from "./_templates/correction-email.tsx";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit and retry configuration
const BASE_DELAY_MS = 600; // safely under 2 req/sec
const MAX_RETRIES = 5;
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJitter(maxJitterMs = 250) {
  return Math.floor(Math.random() * maxJitterMs);
}

function isRateLimitError(err: unknown): boolean {
  try {
    if (!err || typeof err !== 'object') return false;
    const e = err as { statusCode?: number; code?: number; name?: string; message?: string; error?: { statusCode?: number; name?: string; message?: string } };
    if (e.statusCode === 429 || e.code === 429) return true;
    if (typeof e.name === 'string' && e.name.toLowerCase().includes('rate')) return true;
    if (typeof e.message === 'string' && e.message.toLowerCase().includes('rate')) return true;
    if (e.error) {
      if (e.error.statusCode === 429) return true;
      if (typeof e.error.name === 'string' && e.error.name.toLowerCase().includes('rate')) return true;
      if (typeof e.error.message === 'string' && e.error.message.toLowerCase().includes('rate')) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function sendEmailWithRetry(params: { to: string; subject: string; html: string; logContext: string }) {
  let attempt = 0;
  while (true) {
    try {
      const result = await resend.emails.send({
        from: "Tiki Taka <noreply@designingforusers.com>",
        to: [params.to],
        subject: params.subject,
        html: params.html,
      });

      if (result?.error) {
        if (isRateLimitError(result.error)) {
          throw Object.assign(new Error('Rate limit error'), { cause: result.error });
        }
        throw Object.assign(new Error('Send email failed'), { cause: result.error });
      }

      return result;
    } catch (err) {
      const rateLimited = isRateLimitError(err);
      if (!rateLimited && attempt >= 0 && attempt >= MAX_RETRIES) {
        // Non-rate-limit errors: do not retry too many times
        throw err;
      }

      if (rateLimited && attempt < MAX_RETRIES) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt) + getJitter();
        console.warn(`[RateLimit] Attempt ${attempt + 1}/${MAX_RETRIES} for ${params.logContext}. Backing off ${backoff}ms`, { err });
        await sleep(backoff);
        attempt++;
        continue;
      }

      if (!rateLimited) {
        throw err;
      }

      // If rate limited and exhausted retries
      console.error(`[RateLimit] Exhausted retries for ${params.logContext}`, { err });
      throw err;
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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
    // Attempt to read optional JSON body for simple connectivity checks
    let body: unknown = null;
    try {
      body = await req.json();
    } catch (_) {
      // no body provided – that's fine for the main send flow
    }

    // Fast path: allow the admin UI to verify connectivity without sending emails
    const hasActionField = (val: unknown): val is { action?: string } => {
      return typeof val === 'object' && val !== null && 'action' in val;
    };
    if (hasActionField(body) && body.action === 'test_connection') {
      return new Response(
        JSON.stringify({ ok: true, message: 'send-correction-email reachable' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      );
    }

    const baseUrl = "https://tikitaka.designingforusers.com";
    
    // Calculate next Wednesday
    const today = new Date();
    const nextWednesday = new Date(today);
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7;
    if (daysUntilWednesday === 0 && today.getDay() === 3) {
      nextWednesday.setDate(today.getDate() + 7);
    } else {
      nextWednesday.setDate(today.getDate() + daysUntilWednesday);
    }
    
    const weekDate = nextWednesday.toISOString().split('T')[0];
    const formattedDate = nextWednesday.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Processing correction emails for week: ${weekDate}`);

    // Fetch specific admin user only
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'helgihreinn@me.com');

    if (usersError) {
      throw new Error(`Error fetching admin user: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Admin user not found' }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    console.log(`Found admin user to process`);

    let successCount = 0;
    let errorCount = 0;

    type UserRecord = { id: string; email: string; name: string | null };
    const usersTyped: UserRecord[] = (users ?? []) as unknown as UserRecord[];
    const batches = chunkArray(usersTyped, BATCH_SIZE);
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      console.log(`Processing batch ${b + 1}/${batches.length} (size: ${batch.length})`);

      for (const user of batch) {
        try {
          // Get existing weekly response for this user and week
          const { data: existingResponse } = await supabase
            .from('weekly_responses')
            .select('response_token')
            .eq('user_id', user.id)
            .eq('week_date', weekDate)
            .maybeSingle();

          if (!existingResponse) {
            console.log(`No existing response found for user ${user.name}, skipping`);
            continue;
          }

          // Render the email template
          const emailHtml = await renderAsync(
            React.createElement(CorrectionEmail, {
              playerName: user.name,
              weekDate: formattedDate,
              responseToken: existingResponse.response_token,
              baseUrl: baseUrl,
            })
          );

          // Send with retry/backoff on rate-limit errors
          await sendEmailWithRetry({
            to: user.email,
            subject: "Quick Fix - Your Response Links Now Work! ⚽",
            html: emailHtml,
            logContext: `user ${user.email}`,
          });

          console.log(`✅ Correction email sent successfully to ${user.email}`);
          successCount++;

          // Base inter-send delay to remain under provider rate limits
          await sleep(BASE_DELAY_MS);

        } catch (userError) {
          const rateLimited = isRateLimitError(userError);
          if (rateLimited) {
            console.error(`[RateLimit] Final failure for ${user.email} after retries`, { error: userError });
          } else {
            console.error(`Error processing user ${user.email}:`, userError);
          }
          errorCount++;
        }
      }

      if (b < batches.length - 1) {
        console.log(`Pausing ${BATCH_PAUSE_MS}ms before next batch to relieve pressure`);
        await sleep(BATCH_PAUSE_MS);
      }
    }

    const summary = {
      message: `Correction email process completed`,
      totalUsers: users.length,
      emailsSent: successCount,
      errors: errorCount,
      weekDate: formattedDate,
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
    console.error('Error in send-correction-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send correction emails'
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