import { NextResponse } from "next/server";

/**
 * GET /api/auth/quickbooks?uid=<uid>&origin=<nxtchapter|soltheory>
 *
 * Redirects the user to Intuit's OAuth2 authorization page.
 * We request the `com.intuit.quickbooks.accounting` scope and only
 * perform GET (read-only) requests in our backend to honour the
 * user's request for read-only access.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");
  const origin = url.searchParams.get("origin") || "nxtchapter";

  if (!uid) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "QuickBooks Client ID is not configured. Add QUICKBOOKS_CLIENT_ID to .env.local" },
      { status: 500 }
    );
  }

  // Encode state payload so we can recover uid + origin on callback
  const statePayload = Buffer.from(JSON.stringify({ uid, origin })).toString("base64");

  // QuickBooks OAuth2 authorization URL
  // Scope: com.intuit.quickbooks.accounting  (we only do GET requests = read-only)
  const scope = "com.intuit.quickbooks.accounting";

  const authUrl =
    `https://appcenter.intuit.com/connect/oauth2` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(statePayload)}`;

  return NextResponse.redirect(authUrl);
}
