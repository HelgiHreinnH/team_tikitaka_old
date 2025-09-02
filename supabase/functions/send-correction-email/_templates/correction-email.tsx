import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "npm:@react-email/components@0.0.22";
import * as React from "npm:react@18.3.1";

interface CorrectionEmailProps {
  playerName: string;
  weekDate: string;
  responseToken: string;
  baseUrl: string;
}

export const CorrectionEmail = ({
  playerName,
  weekDate,
  responseToken,
  baseUrl,
}: CorrectionEmailProps) => (
  <Html>
    <Head />
    <Preview>Quick correction - Your football response links now work properly!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>TIKI TAKA - Quick Update! 🔧</Heading>
        
        <Text style={text}>
          Hi {playerName}! 👋
        </Text>

        <Text style={text}>
          We noticed there was a technical issue with our previous email where the response buttons weren't working properly. 
          <strong> This has now been fixed!</strong>
        </Text>

        <Text style={text}>
          <strong>Training Session: {weekDate} at 17:30</strong><br/>
          Kunststofbanen, Arsenalvej 2, København
        </Text>

        <Text style={text}>
          Please use the buttons below to let us know if you're coming. The links now work directly from your email!
        </Text>

        <Section style={buttonSection}>
          <Row>
            <Column style={buttonColumn}>
              <Link
                href={`${baseUrl}/respond/${responseToken}?response=yes`}
                style={yesButton}
              >
                I'm Coming! ⚽
              </Link>
            </Column>
            <Column style={buttonColumn}>
              <Link
                href={`${baseUrl}/respond/${responseToken}?response=maybe`}
                style={maybeButton}
              >
                Maybe 🤔
              </Link>
            </Column>
            <Column style={buttonColumn}>
              <Link
                href={`${baseUrl}/respond/${responseToken}?response=no`}
                style={noButton}
              >
                Can't Make It 😔
              </Link>
            </Column>
          </Row>
        </Section>

        <Text style={footerText}>
          Thanks for your patience! Now you can respond directly from your email in one click.
        </Text>

        <Text style={footerText}>
          See you on the pitch! ⚽
        </Text>
      </Container>
    </Body>
  </Html>
);

export default CorrectionEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  maxWidth: "600px",
};

const heading = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#1a1a1a",
  textAlign: "center" as const,
  margin: "0 0 30px 0",
  letterSpacing: "-0.5px",
};

const text = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#374151",
  margin: "0 0 16px 0",
};

const buttonSection = {
  margin: "32px 0",
};

const buttonColumn = {
  width: "33.33%",
  paddingLeft: "4px",
  paddingRight: "4px",
};

const baseButtonStyle = {
  display: "inline-block",
  width: "100%",
  padding: "14px 8px",
  borderRadius: "8px",
  textAlign: "center" as const,
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "600",
  boxSizing: "border-box" as const,
};

const yesButton = {
  ...baseButtonStyle,
  backgroundColor: "#22c55e",
  color: "#ffffff",
};

const maybeButton = {
  ...baseButtonStyle,
  backgroundColor: "#f59e0b",
  color: "#000000",
};

const noButton = {
  ...baseButtonStyle,
  backgroundColor: "#ef4444",
  color: "#ffffff",
};

const footerText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "16px 0 0 0",
};