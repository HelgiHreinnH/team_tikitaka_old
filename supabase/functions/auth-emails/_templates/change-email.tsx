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

interface ChangeEmailEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const ChangeEmailEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: ChangeEmailEmailProps) => (
  <Html>
    <Head />
    <Preview>Confirm your new Tiki Taka email address</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm New Email ⚽</Heading>
        <Text style={text}>
          You've requested to change your email address for Tiki Taka. 
          Click below to confirm this new email address.
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Confirm New Email
        </Link>
        <Text style={text}>
          After confirming, all future training invitations and team updates 
          will be sent to this new email address.
        </Text>
        <Text style={text}>
          <strong>Important:</strong> Your Wednesday training schedule remains unchanged at 17:30.
        </Text>
        <Text style={footer}>
          If you didn't request this change, please contact us immediately or ignore this email.
        </Text>
        <Text style={signature}>
          The Tiki Taka Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ChangeEmailEmail

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