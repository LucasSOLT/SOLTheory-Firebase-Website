import { NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");
  const agentId = url.searchParams.get("agentId") || "email";
  const origin = url.searchParams.get("origin") || "nxtchapter";
  const returnTo = url.searchParams.get("returnTo") || "settings";

  if (!uid) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const statePayload = Buffer.from(JSON.stringify({ uid, agentId, origin, returnTo })).toString('base64');

  // Generate a url that asks permissions for Gmail scopes
  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // getting a refresh token
    prompt: 'consent', // force prompt to ensure refresh token is returned
    scope: scopes,
    state: statePayload // pass the config map explicitly
  });

  return NextResponse.redirect(authorizationUrl);
}
