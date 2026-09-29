import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAllOrgIds } from "@/lib/org-config";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");
  const agentId = url.searchParams.get("agentId") || "email";
  const origin = url.searchParams.get("origin") || getAllOrgIds()[0];
  const returnTo = url.searchParams.get("returnTo") || "settings";

  if (!uid) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const statePayload = Buffer.from(JSON.stringify({ uid, agentId, origin, returnTo })).toString('base64');

  const service = url.searchParams.get("service") || "workspace";

  // Google OAuth forbids combining sensitive Google Drive and YouTube upload scopes in a single authorization request.
  // When service === 'youtube', request YouTube specific scopes; otherwise request standard Workspace (Gmail, Calendar, Contacts, Docs).
  const scopes = service === "youtube"
    ? [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
      ]
    : [
        'https://mail.google.com/',                             // Full Gmail access (read, send, delete, manage)
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'https://www.googleapis.com/auth/gmail.labels',         // Manage labels
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/contacts.readonly',    // Read contacts
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/spreadsheets',
      ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // getting a refresh token
    prompt: 'consent', // force prompt to ensure refresh token is returned
    scope: scopes,
    state: statePayload // pass the config map explicitly
  });

  return NextResponse.redirect(authorizationUrl);
}
