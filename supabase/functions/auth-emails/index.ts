import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { ConfirmSignupEmail } from './_templates/confirm-signup.tsx'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { InviteUserEmail } from './_templates/invite-user.tsx'
import { ChangeEmailEmail } from './_templates/change-email.tsx'
import { ResetPasswordEmail } from './_templates/reset-password.tsx'
import { ReauthenticationEmail } from './_templates/reauthentication.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)
  
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
      }
    }

    let emailComponent: React.ReactElement
    let subject: string

    // Choose the right template based on email_action_type
    switch (email_action_type) {
      case 'signup':
        emailComponent = React.createElement(ConfirmSignupEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'Welcome to Tiki Taka ⚽ - Confirm your account'
        break
        
      case 'magiclink':
        emailComponent = React.createElement(MagicLinkEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'Your Tiki Taka login link ⚽'
        break
        
      case 'invite':
        emailComponent = React.createElement(InviteUserEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'You\'re invited to join Tiki Taka ⚽'
        break
        
      case 'email_change':
        emailComponent = React.createElement(ChangeEmailEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'Confirm your new Tiki Taka email address ⚽'
        break
        
      case 'recovery':
        emailComponent = React.createElement(ResetPasswordEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'Reset your Tiki Taka password ⚽'
        break
        
      case 'reauthentication':
        emailComponent = React.createElement(ReauthenticationEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
        subject = 'Confirm your identity - Tiki Taka ⚽'
        break
        
      default:
        throw new Error(`Unknown email action type: ${email_action_type}`)
    }

    const html = await renderAsync(emailComponent)

    const { error } = await resend.emails.send({
      from: 'Tiki Taka <auth@yourdomain.com>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      throw error
    }

    console.log(`${email_action_type} email sent successfully to ${user.email}`)

  } catch (error) {
    console.error('Error in auth-emails function:', error)
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})