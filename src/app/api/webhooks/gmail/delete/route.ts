import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const { messageId, refreshToken } = await req.json();

    if (!messageId || !refreshToken) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    await gmail.users.messages.trash({ userId: 'me', id: messageId });

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error("Error trashing email:", error);
    return NextResponse.json({ error: error.message || "Failed to delete email" }, { status: 500 });
  }
}
