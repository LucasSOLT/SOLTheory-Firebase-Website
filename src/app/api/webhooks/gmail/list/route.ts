import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { uid, refreshToken } = await req.json();
    if (!uid || !refreshToken) return NextResponse.json({ error: "Missing uid or refresh token" }, { status: 400 });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Step 1: Identify all threads that currently have an active Draft
    const draftsResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:draft',
      maxResults: 100
    });
    
    const draftThreadIds = new Set(
      (draftsResponse.data.messages || [])
        .map(d => d.threadId)
        .filter(Boolean)
    );

    // Step 2: Fetch up to 100 recent messages from the inbox
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 100
    });

    // Step 3: Exclude any messages residing in threads that already have a drafted reply
    const allMessages = response.data.messages || [];
    const messages = allMessages.filter(msg => !draftThreadIds.has(msg.threadId));

    if (messages.length === 0) {
      return NextResponse.json({ status: "success", emails: [] });
    }

    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id as string,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });
        
        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        // internalDate is a reliable unix ms timestamp from Google, much more accurate than RFC 2822 Date headers
        const internalDate = detail.data.internalDate ? parseInt(detail.data.internalDate, 10) : 0;
        
        return {
          id: detail.data.id,
          threadId: detail.data.threadId,
          snippet: detail.data.snippet,
          subject,
          from,
          date,
          internalDate
        };
      })
    );

    // Sort most-recently-received first using the reliable internalDate unix timestamp
    emailDetails.sort((a, b) => b.internalDate - a.internalDate);

    return NextResponse.json({ status: "success", emails: emailDetails });
  } catch (error: any) {
    console.error("Gmail List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
