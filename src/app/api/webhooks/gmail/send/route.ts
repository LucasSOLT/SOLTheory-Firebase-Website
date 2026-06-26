import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { uid, refreshToken, to, cc, subject, body, threadId, inReplyTo, references } = await req.json();

    if (!uid || !refreshToken) {
      return NextResponse.json({ error: "Missing uid or refresh token" }, { status: 400 });
    }
    if (!to || !subject) {
      return NextResponse.json({ error: "Missing 'to' or 'subject'" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Build MIME message with proper UTF-8 encoding
    const htmlBody = body.includes("<") ? body : `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${body.split('\n').join('<br/>')}</div>`;

    // Use quoted-printable-safe approach: encode the full MIME as UTF-8
    const mimeMessage = [
      `MIME-Version: 1.0`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${references || inReplyTo}`] : []),
      ``,
      Buffer.from(htmlBody, 'utf-8').toString('base64'),
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
        ...(threadId ? { threadId } : {}),
      },
    });

    return NextResponse.json({
      status: "success",
      messageId: result.data.id,
      threadId: result.data.threadId,
    });
  } catch (error: any) {
    console.error("Gmail Send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
