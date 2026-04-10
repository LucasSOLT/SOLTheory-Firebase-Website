import { NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); 

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let agentId = "inbound-email";
  let origin = "nxtchapter";
  let returnTo = "settings";

  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    if (decoded.agentId) agentId = decoded.agentId;
    if (decoded.origin) origin = decoded.origin;
    if (decoded.returnTo) returnTo = decoded.returnTo;
  } catch(e) {
    // Fallback if legacy state format string was passed instead of base64
  }

  const subpath = returnTo; // "settings" or "calendar"

  const redirectBase = origin === "soltheory"
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal/dashboard/soltheory/${subpath}`
    : `${process.env.NEXT_PUBLIC_APP_URL}/portal/dashboard/nxtchapter/${subpath}`;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (tokens.refresh_token) {
      return NextResponse.redirect(`${redirectBase}?gmail_connected=true&rt=${tokens.refresh_token}&agent=${agentId}`);
    }

    return NextResponse.redirect(`${redirectBase}?gmail_connected=true&agent=${agentId}`);
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return NextResponse.redirect(`${redirectBase}?gmail_connected=false&error=${encodeURIComponent(error.message)}&agent=${agentId}`);
  }
}

