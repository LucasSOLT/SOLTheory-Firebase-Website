import { NextResponse } from "next/server";

/**
 * GET /api/auth/quickbooks/callback
 *
 * Intuit redirects here after the user grants consent.
 * We exchange the authorization code for access + refresh tokens,
 * then redirect back to the dashboard settings page with the
 * tokens encoded in the URL so the client can persist them in Firestore.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId"); // QuickBooks Company ID

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let uid = "";
  let origin = "nxtchapter";

  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    uid = decoded.uid || "";
    origin = decoded.origin || "nxtchapter";
  } catch {
    return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`;

  const redirectBase = origin === "soltheory"
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal/dashboard/soltheory/settings`
    : `${process.env.NEXT_PUBLIC_APP_URL}/portal/dashboard/nxtchapter/settings`;

  try {
    // Exchange authorization code for tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("QuickBooks token exchange failed:", errBody);
      return NextResponse.redirect(
        `${redirectBase}?tab=profile&qb_connected=false&error=${encodeURIComponent("Token exchange failed")}`
      );
    }

    const tokens = await tokenRes.json();

    // Pass tokens + realmId back to the client via query params.
    // The client will save them to Firestore under the user's doc.
    const params = new URLSearchParams({
      tab: "profile",
      qb_connected: "true",
      qb_access_token: tokens.access_token,
      qb_refresh_token: tokens.refresh_token,
      qb_realm_id: realmId || "",
      qb_expires_in: String(tokens.expires_in || 3600),
    });

    return NextResponse.redirect(`${redirectBase}?${params.toString()}`);
  } catch (error: any) {
    console.error("QuickBooks OAuth Callback Error:", error);
    return NextResponse.redirect(
      `${redirectBase}?tab=profile&qb_connected=false&error=${encodeURIComponent(error.message)}`
    );
  }
}
