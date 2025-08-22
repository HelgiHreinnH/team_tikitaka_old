import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ResetPasswordEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const ResetPasswordEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: ResetPasswordEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your Tiki Taka password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset Password ⚽</Heading>
        <Text style={text}>
          Forgot your password? No problem! 
          Click below to create a new password for your Tiki Taka account.
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Reset Password
        </Link>
        <Text style={text}>
          This link will expire in 60 minutes for security. 
          After resetting, you'll be able to sign in and manage your training responses as usual.
        </Text>
        <Text style={text}>
          <strong>Quick reminder:</strong> Training sessions are every Wednesday at 17:30.
        </Text>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this email. 
          Your account remains secure.
        </Text>
        <Text style={signature}>
          The Tiki Taka Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ResetPasswordEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
}

const h1 = {
  color: '#000000',
  fontSize: '32px',
  fontWeight: '900',
  letterSpacing: '-0.025em',
  lineHeight: '1.2',
  margin: '0 0 32px',
  textAlign: 'center' as const,
}

const text = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: '400',
  lineHeight: '1.6',
  margin: '24px 0',
}

const button = {
  backgroundColor: '#000000',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontFamily: "'Inter', sans-serif",
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '16px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  margin: '24px 0',
}

const footer = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '32px 0 16px',
}

const signature = {
  color: '#000000',
  fontSize: '14px',
  fontWeight: '600',
  margin: '16px 0 0',
}