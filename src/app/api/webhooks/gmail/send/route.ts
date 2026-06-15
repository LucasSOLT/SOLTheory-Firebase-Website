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

    // Build MIME message
    const headers = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${references || inReplyTo}`] : []),
    ];

    // Wrap body in basic HTML template for consistent rendering
    const htmlBody = body.includes("<") ? body : `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${body.replace(/\n/g, "<br/>")}</div>`;

    const rawMessage = [...headers, "", htmlBody].join("\r\n");
    const encodedMessage = Buffer.from(rawMessage)
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
