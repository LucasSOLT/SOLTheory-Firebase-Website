import { NextResponse } from "next/server";
import { google } from "googleapis";

// Recursively find parts in MIME tree
function findParts(payload: any, mimeType: string): any[] {
  const results: any[] = [];
  if (payload.mimeType === mimeType && payload.body?.data) {
    results.push(payload);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...findParts(part, mimeType));
    }
  }
  return results;
}

// Collect attachment metadata
function getAttachments(payload: any): { filename: string; mimeType: string; size: number }[] {
  const attachments: { filename: string; mimeType: string; size: number }[] = [];
  function walk(part: any) {
    if (part.filename && part.filename.length > 0 && part.body) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return attachments;
}

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
          format: 'full',
        });
        
        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const replyTo = headers.find(h => h.name === 'Reply-To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const internalDate = detail.data.internalDate ? parseInt(detail.data.internalDate, 10) : 0;
        const labelIds = detail.data.labelIds || [];

        // Extract body — prefer HTML, fallback to plain text
        let body = '';
        const payload = detail.data.payload;
        if (payload) {
          const htmlParts = findParts(payload, 'text/html');
          const textParts = findParts(payload, 'text/plain');
          
          if (htmlParts.length > 0 && htmlParts[0].body?.data) {
            body = Buffer.from(htmlParts[0].body.data, 'base64url').toString('utf-8');
          } else if (textParts.length > 0 && textParts[0].body?.data) {
            const plainText = Buffer.from(textParts[0].body.data, 'base64url').toString('utf-8');
            // Wrap plain text in basic HTML for consistent rendering
            body = `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.6">${plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          } else if (payload.body?.data) {
            body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
          }
        }

        // Extract attachments
        const attachments = payload ? getAttachments(payload) : [];
        
        return {
          id: detail.data.id,
          threadId: detail.data.threadId,
          snippet: detail.data.snippet,
          subject,
          from,
          to,
          cc,
          replyTo,
          date,
          internalDate,
          labelIds,
          body,
          attachments,
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
