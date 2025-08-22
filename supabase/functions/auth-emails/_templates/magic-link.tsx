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

interface MagicLinkEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const MagicLinkEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: MagicLinkEmailProps) => (
  <Html>
    <Head />
    <Preview>Your Tiki Taka login link is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Quick Login to TIKI TAKA ⚽</Heading>
        <Text style={text}>
          Ready to check who's playing this Wednesday? Click below to sign in instantly.
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Sign In Now
        </Link>
        <Text style={text}>
          This link will expire in 60 minutes for security. 
          If you didn't request this, no worries - just ignore this email.
        </Text>
        <Text style={footer}>
          Training sessions happen every Wednesday at 17:30. See you on the pitch!
        </Text>
        <Text style={signature}>
          The Tiki Taka Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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