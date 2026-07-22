import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { runSystemDiagnostics } from "@/lib/diagnostics/health";
import { getRecentDiagnosticLogs, DiagnosticLog } from "@/lib/diagnostics/logger";

/**
 * SECURITY: This endpoint is restricted to lucas@soltheory.com ONLY.
 * It also requires a secondary password verification.
 * No API key names, masked values, or env var identifiers are returned.
 */

const DEVELOPER_EMAIL = "lucas@soltheory.com";
const SYSTEM_HEALTH_PASSWORD = "89988998";

/** Sanitize diagnostic logs before sending to client — strip errorDetails that may contain env var names */
function sanitizeLogs(logs: DiagnosticLog[]): Omit<DiagnosticLog, "errorDetails">[] {
  return logs.map(({ errorDetails, ...rest }) => rest);
}

export async function GET(req: NextRequest) {
  // Step 1: Firebase auth (also extracts email from the ID token)
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  // Step 2: Developer-only restriction (use email from decoded token — no extra Admin SDK call)
  if (auth.email !== DEVELOPER_EMAIL) {
    return NextResponse.json(
      { error: "Access denied — this panel is restricted to the system developer only" },
      { status: 403 }
    );
  }

  // Step 3: Password verification via header
  const password = req.headers.get("x-system-health-password") || "";
  if (password !== SYSTEM_HEALTH_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid system health password", requiresPassword: true },
      { status: 401 }
    );
  }

  try {
    const report = await runSystemDiagnostics();
    const recentLogs = await getRecentDiagnosticLogs(30);

    return NextResponse.json({
      success: true,
      report,
      logs: sanitizeLogs(recentLogs),
    });
  } catch (error: any) {
    console.error("[System Health API Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to run system health diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Step 1: Firebase auth
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  // Step 2: Developer-only restriction
  if (auth.email !== DEVELOPER_EMAIL) {
    return NextResponse.json(
      { error: "Access denied — this panel is restricted to the system developer only" },
      { status: 403 }
    );
  }

  // Step 3: Password from request body
  let password = "";
  try {
    const body = await req.json();
    password = body.password || "";
  } catch {
    // If body parsing fails, password stays empty
  }

  if (password !== SYSTEM_HEALTH_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid system health password", requiresPassword: true },
      { status: 401 }
    );
  }

  try {
    const report = await runSystemDiagnostics();
    const recentLogs = await getRecentDiagnosticLogs(30);

    return NextResponse.json({
      success: true,
      message: "Diagnostics run completed successfully",
      report,
      logs: sanitizeLogs(recentLogs),
    });
  } catch (error: any) {
    console.error("[System Health API Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to run system health diagnostics" },
      { status: 500 }
    );
  }
}
