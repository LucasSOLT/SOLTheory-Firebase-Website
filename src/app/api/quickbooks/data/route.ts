import { NextResponse } from "next/server";

/**
 * POST /api/quickbooks/data
 *
 * Proxies READ-ONLY requests to the QuickBooks Online API.
 * Accepts: { realmId, accessToken, refreshToken, endpoint }
 * 
 * Supported endpoints:
 *   - "company"        → CompanyInfo
 *   - "accounts"       → Account list (bank accounts)
 *   - "profit_loss"    → Profit & Loss report
 *   - "expenses"       → Purchase/Expense query
 *   - "transactions"   → recent transactions (JournalEntry + Purchase)
 *   - "invoices"       → Invoice list
 *   - "timesheets"     → TimeActivity list
 *
 * If the access token has expired, we attempt a refresh and return
 * the new tokens alongside the data so the client can persist them.
 */

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
    throw new Error(`Token refresh failed: ${errText}`);
  }

  return res.json();
}

async function qboGet(realmId: string, path: string, accessToken: string) {
  const base = getBaseUrl();
  const url = `${base}/${realmId}/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  return res;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { realmId, accessToken, refreshToken, endpoint } = body;

    if (!realmId || !accessToken || !refreshToken || !endpoint) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Map friendly endpoint names to QBO API paths
    const endpointMap: Record<string, string> = {
      company: "companyinfo/" + realmId,
      accounts: "query?query=" + encodeURIComponent("SELECT * FROM Account WHERE AccountType IN ('Bank', 'Other Current Asset', 'Credit Card', 'Other Asset') MAXRESULTS 50"),
      profit_loss: "reports/ProfitAndLoss?date_macro=This Month",
      expenses: "query?query=" + encodeURIComponent("SELECT * FROM Purchase ORDERBY TxnDate DESC MAXRESULTS 20"),
      transactions: "query?query=" + encodeURIComponent("SELECT * FROM Purchase ORDERBY TxnDate DESC MAXRESULTS 10"),
      invoices: "query?query=" + encodeURIComponent("SELECT * FROM Invoice WHERE Balance != '0' ORDERBY DueDate DESC MAXRESULTS 20"),
      invoices_all: "query?query=" + encodeURIComponent("SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 50"),
      timesheets: "query?query=" + encodeURIComponent("SELECT * FROM TimeActivity ORDERBY TxnDate DESC MAXRESULTS 50"),
      aged_receivables: "reports/AgedReceivableDetail?report_date=" + new Date().toISOString().split("T")[0],
      aged_receivables_summary: "reports/AgedReceivable?report_date=" + new Date().toISOString().split("T")[0],
    };

    // Support date-range filtered timesheets
    if (endpoint === "timesheets_range") {
      const { startDate, endDate } = body;
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate required for timesheets_range" }, { status: 400 });
      }
      endpointMap["timesheets_range"] = "query?query=" + encodeURIComponent(
        `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 200`
      );
    }
    
    // Support date-range filtered profit and loss
    if (endpoint === "profit_loss_range") {
      const { startDate, endDate } = body;
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate required for profit_loss_range" }, { status: 400 });
      }
      endpointMap["profit_loss_range"] = `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`;
    }

    const path = endpointMap[endpoint];
    if (!path) {
      return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 });
    }

    let currentAccessToken = accessToken;
    let newTokens: any = null;

    // First attempt
    let res = await qboGet(realmId, path, currentAccessToken);

    // If 401, try refreshing the token
    if (res.status === 401) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        currentAccessToken = refreshed.access_token;
        newTokens = {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || refreshToken,
          expiresIn: refreshed.expires_in,
        };

        // Retry with new token
        res = await qboGet(realmId, path, currentAccessToken);
      } catch (refreshErr: any) {
        return NextResponse.json(
          { error: "Token refresh failed. Please reconnect QuickBooks.", needsReconnect: true },
          { status: 401 }
        );
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("QBO API Error:", res.status, errText);
      return NextResponse.json({ error: `QuickBooks API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      data,
      ...(newTokens ? { newTokens } : {}),
    });
  } catch (error: any) {
    console.error("QuickBooks data route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
