import { NextResponse } from "next/server";
import { saveInstagramConnection } from "@/firebase/firestore/instagram";

/**
 * GET /api/auth/instagram/callback
 *
 * Facebook redirects here after the user grants consent in the OAuth Dialog.
 *
 * Flow:
 *   1. Extract the `code` query parameter.
 *   2. Exchange it for a Short-Lived User Access Token.
 *   3. Exchange that for a Long-Lived User Access Token (~60 days).
 *   4. Query the user's Facebook Pages to find the one linked to an
 *      Instagram Business Account.
 *   5. Encrypt the tokens and persist them in Firestore under
 *      `instagram_connections/{orgId}`.
 *   6. Redirect back to the Instagram campaigning page.
 */

// ---------------------------------------------------------------------------
// Meta Graph API version
// ---------------------------------------------------------------------------
const GRAPH_API_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ---------------------------------------------------------------------------
// Type definitions for Meta API responses
// ---------------------------------------------------------------------------

interface ShortLivedTokenResponse {
  access_token: string;
  token_type: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface InstagramBusinessAccount {
  id: string;
  username?: string;
  profile_picture_url?: string;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: InstagramBusinessAccount;
}

interface PagesResponse {
  data: FacebookPage[];
  paging?: { cursors: { before: string; after: string }; next?: string };
}

// ---------------------------------------------------------------------------
// State payload passed through the OAuth `state` parameter
// ---------------------------------------------------------------------------

interface OAuthState {
  uid: string;
  origin: string; // e.g. "soltheory" | "nxtchapter"
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");

  // ── Environment variables ───────────────────────────────────────────────
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;

  // ── Decode state ────────────────────────────────────────────────────────
  let state: OAuthState = { uid: "", origin: "soltheory" };
  try {
    if (stateRaw) {
      state = JSON.parse(Buffer.from(stateRaw, "base64").toString("utf8"));
    }
  } catch {
    // Fallback — state was malformed; continue with defaults
  }

  const orgId = state.origin || "soltheory";

  // Build the redirect destination for both success and error cases
  const dashboardRedirect = `${appUrl}/portal/dashboard/${orgId}/agentic-campaigning/instagram`;

  // ── Handle user-denied or Facebook-side errors ──────────────────────────
  if (errorParam) {
    console.error("[Instagram OAuth] User denied or error:", errorParam, errorReason);
    return NextResponse.redirect(
      `${dashboardRedirect}?connection=failed&error=${encodeURIComponent(errorReason || errorParam)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${dashboardRedirect}?connection=failed&error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  if (!appId || !appSecret) {
    console.error("[Instagram OAuth] META_APP_ID or META_APP_SECRET is not set.");
    return NextResponse.redirect(
      `${dashboardRedirect}?connection=failed&error=${encodeURIComponent("Server configuration error")}`
    );
  }

  try {
    // ── Step 1: Exchange code for Short-Lived User Access Token ──────────
    const shortLivedRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }),
    );

    if (!shortLivedRes.ok) {
      const errBody = await shortLivedRes.text();
      console.error("[Instagram OAuth] Short-lived token exchange failed:", shortLivedRes.status, errBody);
      throw new Error(`Token exchange failed (${shortLivedRes.status})`);
    }

    const shortLivedData: ShortLivedTokenResponse = await shortLivedRes.json();

    // ── Step 2: Exchange for Long-Lived User Access Token (~60 days) ─────
    const longLivedRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedData.access_token,
        }),
    );

    if (!longLivedRes.ok) {
      const errBody = await longLivedRes.text();
      console.error("[Instagram OAuth] Long-lived token exchange failed:", longLivedRes.status, errBody);
      throw new Error(`Long-lived token exchange failed (${longLivedRes.status})`);
    }

    const longLivedData: LongLivedTokenResponse = await longLivedRes.json();
    const longLivedUserToken = longLivedData.access_token;

    // ── Step 3: Fetch Pages with Instagram Business Account data ─────────
    const pagesRes = await fetch(
      `${GRAPH_BASE}/me/accounts?` +
        new URLSearchParams({
          fields: "name,access_token,instagram_business_account{id,username,profile_picture_url}",
          access_token: longLivedUserToken,
        }),
    );

    if (!pagesRes.ok) {
      const errBody = await pagesRes.text();
      console.error("[Instagram OAuth] Pages fetch failed:", pagesRes.status, errBody);
      throw new Error(`Failed to fetch Facebook Pages (${pagesRes.status})`);
    }

    const pagesData: PagesResponse = await pagesRes.json();

    // ── DEBUG: Log exactly what Meta returned ────────────────────────────
    console.log("[Instagram OAuth] Pages response:", JSON.stringify(pagesData, null, 2));
    console.log(`[Instagram OAuth] Found ${pagesData.data.length} page(s).`);
    for (const page of pagesData.data) {
      console.log(`[Instagram OAuth]   Page: "${page.name}" (${page.id}), IG account:`, page.instagram_business_account || "NONE");
    }

    // ── Step 4: Find the page with an Instagram Business Account ─────────
    let linkedPage = pagesData.data.find(
      (page) => page.instagram_business_account?.id
    );

    // If not found in initial response, try fetching each page individually
    // (some API versions don't return nested IG data in /me/accounts)
    if (!linkedPage) {
      console.log("[Instagram OAuth] No IG account found in /me/accounts, trying individual page lookups...");
      for (const page of pagesData.data) {
        const pageDetailRes = await fetch(
          `${GRAPH_BASE}/${page.id}?` +
            new URLSearchParams({
              fields: "instagram_business_account{id,username,profile_picture_url}",
              access_token: page.access_token,
            }),
        );
        if (pageDetailRes.ok) {
          const pageDetail = await pageDetailRes.json();
          console.log(`[Instagram OAuth]   Page ${page.id} detail:`, JSON.stringify(pageDetail));
          if (pageDetail.instagram_business_account?.id) {
            linkedPage = {
              ...page,
              instagram_business_account: pageDetail.instagram_business_account,
            };
            break;
          }
        }
      }
    }

    if (!linkedPage || !linkedPage.instagram_business_account) {
      console.error("[Instagram OAuth] No page with an Instagram Business Account found. Pages data:", JSON.stringify(pagesData.data.map(p => ({ id: p.id, name: p.name }))));
      return NextResponse.redirect(
        `${dashboardRedirect}?connection=failed&error=${encodeURIComponent(
          "No Facebook Page with a linked Instagram Business Account was found. Please connect your Instagram account to a Facebook Page first."
        )}`
      );
    }

    const igAccount = linkedPage.instagram_business_account;

    // ── Step 5: Persist encrypted connection to Firestore ────────────────
    await saveInstagramConnection(orgId, {
      metaUserAccessToken: longLivedUserToken,
      facebookPageId: linkedPage.id,
      facebookPageAccessToken: linkedPage.access_token,
      instagramBusinessAccountId: igAccount.id,
      instagramUsername: igAccount.username || "",
      instagramProfilePictureUrl: igAccount.profile_picture_url || "",
    });

    // ── Step 6: Redirect to dashboard with success ───────────────────────
    return NextResponse.redirect(`${dashboardRedirect}?connection=success`);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("[Instagram OAuth] Callback error:", error);

    return NextResponse.redirect(
      `${dashboardRedirect}?connection=failed&error=${encodeURIComponent(message)}`
    );
  }
}
