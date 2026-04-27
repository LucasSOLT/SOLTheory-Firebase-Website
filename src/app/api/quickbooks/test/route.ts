import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (server-side)
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "studio-5711990008-7ac2c",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch {
    // May already be initialized
  }
}

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function getBaseUrl() {
  return process.env.QUICKBOOKS_ENVIRONMENT === "sandbox" ? QBO_SANDBOX_BASE : QBO_BASE;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * GET /api/quickbooks/test?uid=<uid>
 * 
 * Diagnostic endpoint: reads QB creds from Firestore, hits the QB API,
 * and returns raw results so we can verify the connection works.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "uid query param required" }, { status: 400 });
  }

  try {
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User document not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const qb = userData?.quickbooksOAuth;

    if (!qb || !qb.refreshToken) {
      return NextResponse.json({
        error: "No QuickBooks credentials found in Firestore",
        hasUserDoc: true,
        fields: Object.keys(userData || {}),
      }, { status: 404 });
    }

    // Try refreshing the token first (access tokens expire after 1 hour)
    let accessToken = qb.accessToken;
    let refreshResult = null;

    try {
      const refreshed = await refreshAccessToken(qb.refreshToken);
      accessToken = refreshed.access_token;
      refreshResult = { success: true, newExpiresIn: refreshed.expires_in };
      
      // Update Firestore with the new tokens
      await db.collection("users").doc(uid).update({
        "quickbooksOAuth.accessToken": refreshed.access_token,
        "quickbooksOAuth.refreshToken": refreshed.refresh_token || qb.refreshToken,
      });
    } catch (refreshErr: any) {
      refreshResult = { success: false, error: refreshErr.message };
    }

    // Now try to fetch company info
    const base = getBaseUrl();
    const companyUrl = `${base}/${qb.realmId}/companyinfo/${qb.realmId}`;
    
    const companyRes = await fetch(companyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    let companyData = null;
    let companyError = null;
    if (companyRes.ok) {
      companyData = await companyRes.json();
    } else {
      companyError = { status: companyRes.status, body: await companyRes.text() };
    }

    // Try P&L report
    const plUrl = `${base}/${qb.realmId}/reports/ProfitAndLoss?date_macro=This Month`;
    const plRes = await fetch(plUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    let plData = null;
    let plError = null;
    if (plRes.ok) {
      plData = await plRes.json();
    } else {
      plError = { status: plRes.status, body: await plRes.text() };
    }

    // Try bank accounts
    const accountsUrl = `${base}/${qb.realmId}/query?query=${encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 20")}`;
    const accountsRes = await fetch(accountsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    let accountsData = null;
    let accountsError = null;
    if (accountsRes.ok) {
      accountsData = await accountsRes.json();
    } else {
      accountsError = { status: accountsRes.status, body: await accountsRes.text() };
    }

    return NextResponse.json({
      status: "diagnostic_complete",
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "not set",
      realmId: qb.realmId,
      tokenRefresh: refreshResult,
      company: companyData ? { name: companyData.CompanyInfo?.CompanyName } : { error: companyError },
      profitAndLoss: plData || { error: plError },
      bankAccounts: accountsData || { error: accountsError },
      connectedAt: qb.connectedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
