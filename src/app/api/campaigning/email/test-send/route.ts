import { NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  try {
    const { refreshToken, html, subject, senderEmail, testRecipientEmail } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }
    if (!html || !subject) {
      return NextResponse.json({ error: "Missing 'html' or 'subject'" }, { status: 400 });
    }
    if (!testRecipientEmail) {
      return NextResponse.json({ error: "Missing 'testRecipientEmail'" }, { status: 400 });
    }

    // OAuth2 client setup — same pattern as webhooks/gmail/send
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Prefix subject with [TEST]
    const testSubject = `[TEST] ${subject}`;

    // Build MIME message — use the HTML as-is (no wrapping in <p> tags)
    const mimeMessage = [
      `MIME-Version: 1.0`,
      ...(senderEmail ? [`From: ${senderEmail}`] : []),
      `To: ${testRecipientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(testSubject, "utf-8").toString("base64")}?=`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(html, "utf-8").toString("base64"),
    ].join("\r\n");

    const encodedMessage = Buffer.from(mimeMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return NextResponse.json({
      status: "success",
      messageId: result.data.id,
      threadId: result.data.threadId,
    });
  } catch (error: any) {
    console.error("Test Email Send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
