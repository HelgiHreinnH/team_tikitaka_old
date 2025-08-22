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

interface InviteUserEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const InviteUserEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: InviteUserEmailProps) => (
  <Html>
    <Head />
    <Preview>You're invited to join Tiki Taka!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Join TIKI TAKA ⚽</Heading>
        <Text style={text}>
          You've been invited to join our football team! 
          We play every Wednesday at 17:30 and would love to have you on the pitch.
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Accept Invitation
        </Link>
        <Text style={text}>
          Once you accept, you'll be added to our weekly training sessions and can easily 
          let us know if you're available each week.
        </Text>
        <Text style={text}>
          <strong>What to expect:</strong><br />
          • Weekly training every Wednesday at 17:30<br />
          • Simple YES/NO/MAYBE responses via email<br />
          • Real-time team availability updates<br />
          • Minimalist, distraction-free experience
        </Text>
        <Text style={footer}>
          If you're not interested, no problem - just ignore this email.
        </Text>
        <Text style={signature}>
          The Tiki Taka Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteUserEmail

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