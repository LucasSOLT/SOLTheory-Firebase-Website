import { NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { subject, htmlBody, recipients, refreshToken, sendMode } = body;

    if (!refreshToken) {
      return NextResponse.json({ error: "No Gmail account connected. Please connect via Settings or AI Agents first." }, { status: 400 });
    }
    if (!subject || !htmlBody || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Missing required fields or recipients" }, { status: 400 });
    }
    if (recipients.length > 100) {
      return NextResponse.json({ error: "Maximum 100 recipients per batch. Please select fewer contacts." }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Force token refresh to get a valid access token before sending
    try {
      await oauth2Client.getAccessToken();
    } catch (tokenErr: any) {
      console.error("Token refresh failed:", tokenErr);
      return NextResponse.json({ error: "Gmail token expired. Please reconnect your Gmail account in Settings." }, { status: 401 });
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get sender email for the "From" header
    let senderEmail = "me";
    try {
      const profile = await gmail.users.getProfile({ userId: "me" });
      senderEmail = profile.data.emailAddress || "me";
    } catch {
      // Fallback — "me" will still work for sending
    }

    let sentCount = 0;
    const errors: string[] = [];

    // CC Mode: Send a single email with all recipients in To + CC
    if (sendMode === "cc") {
      try {
        const primaryRecipient = recipients[0];
        const ccRecipients = recipients.slice(1);
        const emailLines = [
          `MIME-Version: 1.0`,
          `From: ${senderEmail}`,
          `To: ${primaryRecipient}`,
          ...(ccRecipients.length > 0 ? [`Cc: ${ccRecipients.join(", ")}`] : []),
          `Subject: ${subject}`,
          `Content-Type: text/html; charset=utf-8`,
          ``,
          htmlBody
        ];

        const raw = Buffer.from(emailLines.join('\r\n'))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw }
        });

        sentCount = recipients.length;
      } catch (err: any) {
        console.error("Failed to send CC email:", err?.message || err);
        errors.push(`Failed: ${err.message}`);
      }
    } else {
      // Individual Mode: Send to each recipient separately via Gmail API
      for (const recipient of recipients) {
        try {
          const emailLines = [
            `MIME-Version: 1.0`,
            `From: ${senderEmail}`,
            `To: ${recipient}`,
            `Subject: ${subject}`,
            `Content-Type: text/html; charset=utf-8`,
            ``,
            htmlBody
          ];
          
          const raw = Buffer.from(emailLines.join('\r\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
          });
          
          sentCount++;
        } catch (err: any) {
          console.error(`Failed to send to ${recipient}:`, err?.message || err);
          errors.push(`Failed for ${recipient}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount, 
      total: recipients.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Email Campaign Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
